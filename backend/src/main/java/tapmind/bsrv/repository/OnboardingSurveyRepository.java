package tapmind.bsrv.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.enums.OnboardingStatus;
import tapmind.bsrv.model.OnboardingSurvey;

@Repository
public interface OnboardingSurveyRepository extends JpaRepository<OnboardingSurvey, String> {

    List<OnboardingSurvey> findByEmployeeIdOrderBySentOnDesc(Integer employeeId);

    List<OnboardingSurvey> findByStatusOrderBySentOnDesc(OnboardingStatus status);

    @Query(value = "SELECT * FROM onboarding_surveys o WHERE (:status = 'ALL' OR o.status = :status) ORDER BY o.sent_on DESC", nativeQuery = true)
    List<OnboardingSurvey> findAllFiltered(@Param("status") String status);

    @Query("SELECT COUNT(o) FROM OnboardingSurvey o WHERE o.status = 'SUBMITTED'")
    long countSubmitted();

    @Query("SELECT COUNT(o) FROM OnboardingSurvey o")
    long countAll();

    @Query("SELECT COALESCE(AVG(CAST(o.answers AS double)), 0) FROM OnboardingSurvey o WHERE o.status = 'SUBMITTED'")
    Double computeOverallAvg();

    @Query(value = "SELECT o.department, AVG(CAST(o.answers AS DOUBLE)) FROM onboarding_surveys o WHERE o.status = 'SUBMITTED' GROUP BY o.department", nativeQuery = true)
    List<Object[]> computeDeptAverages();

    Optional<OnboardingSurvey> findTopByOrderByIdDesc();
}
