package tapmind.bsrv.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.EngagementResponse;

@Repository
public interface EngagementResponseRepository extends JpaRepository<EngagementResponse, Long> {

    List<EngagementResponse> findBySurveyIdOrderByCreatedAtAsc(String surveyId);

    Optional<EngagementResponse> findBySurveyIdAndRespondentId(String surveyId, Integer respondentId);

    boolean existsBySurveyIdAndRespondentId(String surveyId, Integer respondentId);

    long countBySurveyId(String surveyId);

    @Query("SELECT AVG(CAST(e.months AS double)) FROM EngagementResponse e WHERE e.survey.id = :surveyId")
    Double computeAvgBySurveyId(@Param("surveyId") String surveyId);
}
