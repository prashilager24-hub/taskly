package tapmind.bsrv.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.PushSubscription;
import java.util.List;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    List<PushSubscription> findByUserId(Integer userId);

    void deleteByUserIdAndEndpoint(Integer userId, String endpoint);

    List<PushSubscription> findByUserIdIn(List<Integer> userIds);

    List<PushSubscription> findByTeam(String team);

    @Modifying
    @Query(value = "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, team, created_at, updated_at) " +
            "VALUES (:userId, :endpoint, :p256dh, :auth, :team, NOW(), NOW()) " +
            "ON DUPLICATE KEY UPDATE p256dh = :p256dh, auth = :auth, team = :team, updated_at = NOW()",
            nativeQuery = true)
    void upsertSubscription(@Param("userId") Integer userId,
                            @Param("endpoint") String endpoint,
                            @Param("p256dh") String p256dh,
                            @Param("auth") String auth,
                            @Param("team") String team);
}
