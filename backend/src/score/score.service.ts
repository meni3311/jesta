import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Jesta Score — 0-100 composite trust score, stored on users.jestaScore.
 *
 *   40%  average rating          (1-5 stars → 0-100)
 *   30%  attendance rate         (showUpCount / (showUpCount + noShowCount))
 *   20%  response speed          (avg minutes to confirm arrival)
 *   10%  completed gestas count  (capped at 20)
 *
 * Neutral baselines for users with no history yet (so new users start at 60,
 * not 0): rating → 50, attendance → 100, response → 50, completed → 0.
 */
const WEIGHT = { rating: 0.4, attendance: 0.3, response: 0.2, completed: 0.1 };
const NEUTRAL = { rating: 50, attendance: 100, response: 50 };

/** ≤15 min to confirm = 100 · ≥12 h = 0 · linear in between */
function responseSpeedScore(avgMinutes: number): number {
  const BEST_MIN = 15;
  const WORST_MIN = 12 * 60;
  if (avgMinutes <= BEST_MIN) return 100;
  if (avgMinutes >= WORST_MIN) return 0;
  return 100 * (1 - (avgMinutes - BEST_MIN) / (WORST_MIN - BEST_MIN));
}

@Injectable()
export class ScoreService {
  private readonly logger = new Logger(ScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalculate and persist a user's jestaScore from their current counters.
   * Call after every completed or failed (no-show) gesta, new rating, or
   * arrival confirmation. Never throws — a scoring failure must not break
   * the business flow that triggered it.
   */
  async recalculate(userId: string): Promise<number | null> {
    try {
      const u = await this.prisma.db.user.findUnique({
        where: { id: userId },
        select: {
          rating: true, ratingCount: true,
          showUpCount: true, noShowCount: true,
          responseCount: true, responseTotalMin: true,
          completedJobs: true,
        },
      });
      if (!u) return null;

      const ratingScore = u.ratingCount > 0 ? (u.rating / 5) * 100 : NEUTRAL.rating;

      const attended = u.showUpCount + u.noShowCount;
      const attendanceScore = attended > 0 ? (u.showUpCount / attended) * 100 : NEUTRAL.attendance;

      const responseScore = u.responseCount > 0
        ? responseSpeedScore(u.responseTotalMin / u.responseCount)
        : NEUTRAL.response;

      const completedScore = (Math.min(u.completedJobs, 20) / 20) * 100;

      const jestaScore = Math.round(
        ratingScore     * WEIGHT.rating +
        attendanceScore * WEIGHT.attendance +
        responseScore   * WEIGHT.response +
        completedScore  * WEIGHT.completed,
      );

      await this.prisma.db.user.update({ where: { id: userId }, data: { jestaScore } });
      return jestaScore;
    } catch (err) {
      this.logger.error(`jestaScore recalculation failed for ${userId}: ${(err as Error).message}`);
      return null;
    }
  }
}
