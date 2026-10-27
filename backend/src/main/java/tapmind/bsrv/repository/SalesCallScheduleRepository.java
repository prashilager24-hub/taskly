package tapmind.bsrv.repository;

import tapmind.bsrv.model.SalesCallSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.time.LocalDate;
@Repository
public interface SalesCallScheduleRepository extends JpaRepository<SalesCallSchedule, Long> {

   @Query("""
    SELECT
        COUNT(CASE WHEN s.status = 'SCHEDULED' THEN 1 END),
        COUNT(CASE WHEN s.status = 'COMPLETED' THEN 1 END)
    FROM SalesCallSchedule s
    WHERE s.salesUserID = :userId
      AND DATE(s.scheduledDatetime) = :workDate
""")
Object[] fetchSalesCallStats(
        @Param("userId") Integer userId,
        @Param("workDate") LocalDate workDate
);

@Query("""
    SELECT 
        s.salesUserID,
        DATE(s.scheduledDatetime),
        COUNT(CASE WHEN s.status = 'SCHEDULED' THEN 1 END),
        COUNT(CASE WHEN s.status = 'COMPLETED' THEN 1 END)
    FROM SalesCallSchedule s
    GROUP BY s.salesUserID, DATE(s.scheduledDatetime)
""")
List<Object[]> fetchSalesGroupedByUserAndDate();



@Query("""
SELECT COUNT(c)
FROM SalesCallSchedule c
WHERE c.salesUserID = :userID
AND c.status IN ('SCHEDULED','COMPLETED','NO_SHOW')
AND DATE(c.scheduledDatetime) BETWEEN :from AND :to
""")
int countScheduledCalls(
        Integer userID,
        LocalDate from,
        LocalDate to
);

@Query("""
SELECT COUNT(c)
FROM SalesCallSchedule c
WHERE c.salesUserID = :userID
AND c.status = 'COMPLETED'
AND DATE(c.actualCallDatetime) BETWEEN :from AND :to
""")
int countCompletedCalls(
        Integer userID,
        LocalDate from,
        LocalDate to
);



}
