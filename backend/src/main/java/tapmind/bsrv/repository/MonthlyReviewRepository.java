package tapmind.bsrv.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import tapmind.bsrv.entity.MonthlyReview;

@Repository
public interface MonthlyReviewRepository
        extends JpaRepository<MonthlyReview, Integer> {

    List<MonthlyReview> findByEmpId(Integer empId);

    List<MonthlyReview> findByEmpIdAndMonthAndYear(
            Integer empId,
            String month,
            Integer year);

    List<MonthlyReview> findByEmpIdAndMonthAndYearAndStartDateAndEndDate(
            Integer empId,
            String month,
            Integer year,
            LocalDate startDate,
            LocalDate endDate);

    @Query("""
                SELECT DISTINCT mr.empId
                FROM MonthlyReview mr
                WHERE mr.year = :year
                  AND mr.month = :month
            """)
    List<Integer> findReviewedEmpIdsByMonthAndYear(
            @Param("month") String month,
            @Param("year") Integer year);
}