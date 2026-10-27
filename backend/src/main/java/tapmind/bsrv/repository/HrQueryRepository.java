package tapmind.bsrv.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.enums.QueryStatus;
import tapmind.bsrv.enums.QueryTeam;
import tapmind.bsrv.model.HrQuery;

@Repository
public interface HrQueryRepository extends JpaRepository<HrQuery, String> {

    List<HrQuery> findByEmployeeIdOrderByRaisedOnDesc(Integer employeeId);

    List<HrQuery> findByTeamOrderByRaisedOnDesc(QueryTeam team);

    List<HrQuery> findByTeamAndStatusIn(QueryTeam team, List<QueryStatus> statuses);

    @Query("SELECT q FROM HrQuery q WHERE q.team = :team ORDER BY q.raisedOn DESC")
    List<HrQuery> findByTeamAll(@Param("team") QueryTeam team);

    @Query("SELECT COUNT(q) FROM HrQuery q WHERE q.team = :team AND q.status IN ('OPEN', 'IN_PROGRESS')")
    long countOpenByTeam(@Param("team") QueryTeam team);

    @Query("SELECT COUNT(q) FROM HrQuery q WHERE q.team = :team AND q.ageHours > 72 AND q.status IN ('OPEN', 'IN_PROGRESS')")
    long countOverdueByTeam(@Param("team") QueryTeam team);

    @Query("SELECT COUNT(q) FROM HrQuery q WHERE q.team = :team AND q.status IN ('RESOLVED', 'CLOSED')")
    long countResolvedByTeam(@Param("team") QueryTeam team);

    @Query("SELECT COUNT(q) FROM HrQuery q")
    long countAll();

    @Query("SELECT COUNT(q) FROM HrQuery q WHERE q.status IN ('RESOLVED', 'CLOSED')")
    long countResolved();

    @Query("SELECT COUNT(q) FROM HrQuery q WHERE q.status IN ('OPEN', 'IN_PROGRESS')")
    long countOpen();

    @Query("SELECT COUNT(q) FROM HrQuery q WHERE q.ageHours > 72 AND q.status IN ('OPEN', 'IN_PROGRESS')")
    long countSlaBreached();

    Optional<HrQuery> findTopByOrderByIdDesc();

    @Query("SELECT DISTINCT q.employeeId FROM HrQuery q WHERE q.team = :team")
    List<Integer> findDistinctEmployeeIdsByTeam(@Param("team") QueryTeam team);
}
