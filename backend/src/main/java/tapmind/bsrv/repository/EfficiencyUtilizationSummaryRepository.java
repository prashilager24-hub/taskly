package tapmind.bsrv.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.repository.Modifying;

import tapmind.bsrv.model.DepartmentUser;
import tapmind.bsrv.model.DepartmentUserID;
import tapmind.bsrv.model.Department;
import tapmind.bsrv.model.User;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.List;
import tapmind.bsrv.model.EfficiencyUtilizationSummary; // adjust package
import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface EfficiencyUtilizationSummaryRepository
    extends JpaRepository<EfficiencyUtilizationSummary, Integer> {

  Optional<EfficiencyUtilizationSummary> findByUserIDAndDepartmentIDAndWorkDate(
      Integer userID, Integer departmentID, LocalDate workDate);

  @Modifying
  @Transactional
  @Query(value = "TRUNCATE TABLE EfficiencyUtilizationSummary", nativeQuery = true)
  void truncateTable();

  @Query(
"""
    SELECT e.targetAchievedPercent
    FROM EfficiencyUtilizationSummary e
    WHERE e.userID = :userId
      AND e.workDate = :workDate
      AND e.departmentID = :departmentId
""")
  BigDecimal findTargetAchievedPercent(
      @Param("userId") Integer userId,
      @Param("workDate") LocalDate workDate,
      @Param("departmentId") Integer departmentId);
}
