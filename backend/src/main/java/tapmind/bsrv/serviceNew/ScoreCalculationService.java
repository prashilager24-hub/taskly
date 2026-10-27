package tapmind.bsrv.serviceNew;

import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.stereotype.Service;
import tapmind.bsrv.dto.RadarData;
import tapmind.bsrv.dto.ScoreBand;
import tapmind.bsrv.model.SprintEntry;

/**
 * Mirrors every formula defined in Section 6, 7, 8 of the Taskly spec.
 * The DB stores all five scores as generated columns — this service is used
 * for (a) live-preview endpoints and (b) dashboard enrichment that needs
 * fields not persisted (radar axes, bands, rating labels).
 */
@Service
public class ScoreCalculationService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal FIVE    = BigDecimal.valueOf(5);
    private static final BigDecimal FIFTEEN = BigDecimal.valueOf(15);
    private static final BigDecimal TWENTY  = BigDecimal.valueOf(20);

    // ── 6.1 Completion Rate ───────────────────────────────────────────────
    public BigDecimal completionRate(int spCompleted, int spCommitted) {
        if (spCommitted == 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(spCompleted)
                .divide(BigDecimal.valueOf(spCommitted), 10, RoundingMode.HALF_UP)
                .multiply(HUNDRED)
                .min(HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);
    }

    // ── 6.2 Utilisation ───────────────────────────────────────────────────
    public BigDecimal utilisation(int daysPresent) {
        return BigDecimal.valueOf(daysPresent)
                .divide(FIVE, 10, RoundingMode.HALF_UP)
                .multiply(HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);
    }

    // ── 6.3 Quality Score ─────────────────────────────────────────────────
    public BigDecimal qualityScore(int bugsIntroduced) {
        BigDecimal penalty = FIFTEEN.multiply(BigDecimal.valueOf(bugsIntroduced));
        return HUNDRED.subtract(penalty).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    // ── 6.4 Efficiency Score ──────────────────────────────────────────────
    public BigDecimal efficiencyScore(BigDecimal completion, BigDecimal utilisation, BigDecimal quality) {
        return completion.multiply(BigDecimal.valueOf(0.40))
                .add(utilisation.multiply(BigDecimal.valueOf(0.35)))
                .add(quality.multiply(BigDecimal.valueOf(0.25)))
                .setScale(2, RoundingMode.HALF_UP);
    }

    // ── 6.5 Overall Score ─────────────────────────────────────────────────
    public BigDecimal overallScore(BigDecimal efficiency, int selfRating) {
        BigDecimal normSelfRating = BigDecimal.valueOf(selfRating).multiply(BigDecimal.TEN);
        return efficiency.multiply(BigDecimal.valueOf(0.60))
                .add(normSelfRating.multiply(BigDecimal.valueOf(0.40)))
                .setScale(2, RoundingMode.HALF_UP);
    }

    // ── Convenience: compute all five at once ─────────────────────────────
    public AllScores computeAll(SprintEntry e) {
        BigDecimal cr  = completionRate(e.getSpCompleted(), e.getSpCommitted());
        BigDecimal ut  = utilisation(e.getDaysPresent());
        BigDecimal qs  = qualityScore(e.getBugsIntroduced());
        BigDecimal eff = efficiencyScore(cr, ut, qs);
        BigDecimal ov  = overallScore(eff, e.getSelfRating());
        return new AllScores(cr, ut, qs, eff, ov);
    }

    public record AllScores(
            BigDecimal completion,
            BigDecimal utilisation,
            BigDecimal quality,
            BigDecimal efficiency,
            BigDecimal overall) {}

    // ── 7. Threshold Bands ────────────────────────────────────────────────
    /**
     * Standard three-band system used for Completion, Utilisation, Quality, Efficiency.
     */
    public ScoreBand band(BigDecimal score) {
        if (score == null) return ScoreBand.BELOW;
        int v = score.intValue();
        if (v >= 85) return ScoreBand.ON_TARGET;
        if (v >= 65) return ScoreBand.MODERATE;
        return ScoreBand.BELOW;
    }

    // ── 7.1 Overall Rating Label ──────────────────────────────────────────
    public String overallRating(BigDecimal overall) {
        if (overall == null) return "NEEDS_FOCUS";
        int v = overall.intValue();
        if (v >= 85) return "EXCELLENT";
        if (v >= 70) return "GOOD";
        if (v >= 55) return "FAIR";
        return "NEEDS_FOCUS";
    }

    // ── 8. Performance Radar ──────────────────────────────────────────────
    public RadarData radar(SprintEntry e, int goalsMet, int totalGoals) {
        BigDecimal goalsPct = totalGoals == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(goalsMet)
                        .divide(BigDecimal.valueOf(totalGoals), 10, RoundingMode.HALF_UP)
                        .multiply(HUNDRED)
                        .setScale(2, RoundingMode.HALF_UP);

        BigDecimal reviewsPts = BigDecimal.valueOf(e.getPrReviews())
                .multiply(TWENTY)
                .min(HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);

        return RadarData.builder()
                .utilisation(utilisation(e.getDaysPresent()))
                .velocity(completionRate(e.getSpCompleted(), e.getSpCommitted()))
                .reviews(reviewsPts)
                .quality(qualityScore(e.getBugsIntroduced()))
                .goals(goalsPct)
                .self(BigDecimal.valueOf(e.getSelfRating()).multiply(BigDecimal.TEN))
                .build();
    }

    // ── 9. Goal Progress ──────────────────────────────────────────────────
    public BigDecimal goalProgress(int achieved, int target) {
        if (target == 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(achieved)
                .divide(BigDecimal.valueOf(target), 10, RoundingMode.HALF_UP)
                .multiply(HUNDRED)
                .min(HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);
    }
}
