package tapmind.bsrv.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.QuarterlyReview;

@Repository
public interface QuarterlyReviewRepository
                extends JpaRepository<QuarterlyReview, Integer> {

        Optional<QuarterlyReview> findByEmployee_UserIDAndQuarterAndQuarterYear(
                        Integer empId,
                        String quarter,
                        Integer quarterYear);

        List<QuarterlyReview> findByEmployee_UserIDOrderByCreatedAtDesc(
                        Integer empId);

        List<QuarterlyReview> findAllByOrderByCreatedAtDesc();

        @Query("""
                        SELECT DISTINCT qr.employee.userID
                        FROM QuarterlyReview qr
                        WHERE qr.quarter = :quarter
                          AND qr.quarterYear = :year
                """)
        List<Integer> findReviewedEmpIdsByQuarterAndYear(
                        @Param("quarter") String quarter,
                        @Param("year") Integer year);

        @Query("""
                        SELECT qr.employee.userID, qr.employee.name, qr.employee.userEmail, COUNT(qr),
                          MAX(qr.systemGrade), MAX(qr.managerAvgRating), MAX(qr.finalRating), MAX(qr.managerRatings),
                          MAX(qr.targetPercent), MAX(qr.goalAchievement),
                          MAX(u.employeeID), MAX(rm.name), MAX(el.name),
                          (SELECT MAX(d.departmentName) FROM DepartmentUser du2 JOIN du2.department d WHERE du2.user.userID = u.userID)
                        FROM QuarterlyReview qr
                        JOIN qr.employee u
                        LEFT JOIN u.reportingManager rm
                        LEFT JOIN u.elManager el
                        WHERE qr.quarterYear = :year
                          AND qr.quarter IN :quarters
                          AND (:departmentID IS NULL OR EXISTS (
                              SELECT 1
                              FROM DepartmentUser du
                              WHERE du.user.userID = u.userID
                                AND du.department.departmentID = :departmentID
                          ))
                        GROUP BY qr.employee.userID, qr.employee.name, qr.employee.userEmail
                        ORDER BY u.name
                """)
        List<Object[]> findReviewedSummaryByQuartersAndYear(
                        @Param("quarters") List<String> quarters,
                        @Param("year") Integer year,
                        @Param("departmentID") Integer departmentID);
}