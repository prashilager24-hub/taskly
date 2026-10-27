package tapmind.bsrv.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.enums.EngagementStatus;
import tapmind.bsrv.model.EngagementSurvey;

@Repository
public interface EngagementSurveyRepository extends JpaRepository<EngagementSurvey, String> {

    List<EngagementSurvey> findByStatusOrderByOpensDesc(EngagementStatus status);

    List<EngagementSurvey> findAllByOrderByOpensDesc();

    @Query("SELECT e FROM EngagementSurvey e WHERE e.status = 'COLLECTING' ORDER BY e.opens DESC")
    List<EngagementSurvey> findOpenSurveys();

    Optional<EngagementSurvey> findTopByOrderByIdDesc();
}
