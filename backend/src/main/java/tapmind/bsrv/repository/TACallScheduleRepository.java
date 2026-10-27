package tapmind.bsrv.repository;

import tapmind.bsrv.entity.*;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Pageable;
public interface TACallScheduleRepository extends JpaRepository<TACallSchedule, Long> {

    @Query("""
        SELECT c FROM TACallSchedule c
        WHERE (:taUserID IS NULL OR c.taUserID = :taUserID)
          AND (:positionID IS NULL OR c.positionID = :positionID)
          AND (:start IS NULL OR c.scheduledDatetime >= :start)
          AND (:end IS NULL OR c.scheduledDatetime <= :end)
        ORDER BY c.scheduledDatetime DESC
    """)
    List<TACallSchedule> filterCalls(Integer taUserID, Integer positionID,
                                     LocalDateTime start, LocalDateTime end);


    @Query("""
    SELECT c FROM TACallSchedule c
    WHERE (:taUserID IS NULL OR c.taUserID = :taUserID)
      AND (:positionID IS NULL OR c.positionID = :positionID)
      AND (:startDate IS NULL OR c.scheduledDatetime >= :startDate)
      AND (:endDate IS NULL OR c.scheduledDatetime <= :endDate)
""")
Page<TACallSchedule> filterCallsPaged(
        Integer taUserID,
        Integer positionID,
        LocalDateTime startDate,
        LocalDateTime endDate,
        Pageable pageable
);

@Query(value = """
    SELECT 
        t.TAUserID,
        DATE(t.ScheduledDatetime) AS workDate,
        COUNT(CASE WHEN t.Status = 'SCHEDULED' THEN 1 END) AS scheduledCalls,
        COUNT(CASE WHEN t.Status = 'COMPLETED' THEN 1 END) AS completedCalls
    FROM TACallSchedule t
    GROUP BY t.TAUserID, DATE(t.ScheduledDatetime)
""", nativeQuery = true)
List<Object[]> fetchTAGroupedByUserAndDate();


}
