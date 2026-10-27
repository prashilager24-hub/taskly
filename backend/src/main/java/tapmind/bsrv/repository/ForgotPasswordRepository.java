package tapmind.bsrv.repository;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.model.ForgotPassword;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
import java.time.LocalDateTime;

@Repository
public interface ForgotPasswordRepository extends JpaRepository<ForgotPassword, Integer> {

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO ForgotPassword (uuid, user_id, start_time, end_time, status) VALUES (?1, ?2, ?3, ?4, ?5)", nativeQuery = true)
    void insertForgotPassword(String uuid, int userId, String startTime, String endTime, boolean status);


    Optional<ForgotPassword> findByUuidAndStatusTrue(String uuid);

         @Query("SELECT f FROM ForgotPassword f WHERE f.endTime < :now AND (f.status = false OR f.status IS NULL)")
    List<ForgotPassword> findExpiredTokens(@Param("now") Date now);

    
}
