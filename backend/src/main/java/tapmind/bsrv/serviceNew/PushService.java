package tapmind.bsrv.serviceNew;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.model.PushSubscription;
import tapmind.bsrv.repository.HrQueryRepository;
import tapmind.bsrv.repository.PushSubscriptionRepository;

import java.security.Security;
import java.util.Base64;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushService {

    private final PushSubscriptionRepository subRepo;
    private final HrQueryRepository queryRepo;
    private final JdbcTemplate jdbcTemplate;

    private static final String VAPID_SUBJECT = "mailto:hr@tapmind.com";
    private static final String VAPID_PUBLIC_KEY_HEX = "3059301306072a8648ce3d020106082a8648ce3d03010703420004c795c774fd7de011c155e232faf36320fd3b5e77e59254bbcb80056f8ff55b1582faed8cbcf85a850139c6365e79bf9236ca7c163991f6b851e54370ea040673";
    private static final String VAPID_PRIVATE_KEY_HEX = "3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420e005f7437dd0bc736ff38bd9e42221e8876d220516616af5d27d82ec52854bd5";

    private nl.martijndwars.webpush.PushService pushService;

    @PostConstruct
    public void init() {
        try {
            if (Security.getProvider("BC") == null) {
                Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());
            }
            java.security.KeyFactory kf = java.security.KeyFactory.getInstance("EC", "BC");
            java.security.PrivateKey privateKey = kf.generatePrivate(
                    new java.security.spec.PKCS8EncodedKeySpec(
                            hexToBytes(VAPID_PRIVATE_KEY_HEX)));
            java.security.PublicKey publicKey = kf.generatePublic(
                    new java.security.spec.X509EncodedKeySpec(
                            hexToBytes(VAPID_PUBLIC_KEY_HEX)));

            java.security.KeyPair keyPair = new java.security.KeyPair(publicKey, privateKey);
            this.pushService = new nl.martijndwars.webpush.PushService(
                    keyPair, VAPID_SUBJECT);
            log.info("Push service initialized with VAPID keys");
        } catch (Exception e) {
            log.error("Failed to initialize push service: {}", e.getMessage(), e);
        }
    }

    public String getVapidPublicKey() {
        // Frontend needs the raw uncompressed EC point (65 bytes), not SPKI
        // Extract from SPKI: skip header (12 bytes), take remaining 65 bytes
        byte[] spki = hexToBytes(VAPID_PUBLIC_KEY_HEX);
        byte[] rawPoint = new byte[65];
        System.arraycopy(spki, spki.length - 65, rawPoint, 0, 65);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(rawPoint);
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] bytes = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            bytes[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return bytes;
    }

    @Transactional
    public void saveSubscription(Integer userId, String endpoint, String p256dh, String auth, String team) {
        String resolvedTeam = resolveTeam(userId);
        if (resolvedTeam == null) {
            resolvedTeam = team;
        }
        subRepo.upsertSubscription(userId, endpoint, p256dh, auth, resolvedTeam);
        log.info("Push subscription saved for user {} team={}", userId, resolvedTeam);
    }

    private String resolveTeam(Integer userId) {
        try {
            List<Integer> depts = jdbcTemplate.queryForList(
                    "SELECT DepartmentID FROM DepartmentUser WHERE UserID = ?",
                    Integer.class, userId);
            for (Integer dept : depts) {
                if (dept != null && (dept == 71 || dept == 16)) {
                    return "HR";
                }
            }
        } catch (Exception e) {
            log.warn("Failed to resolve team for user {}: {}", userId, e.getMessage());
        }
        return null;
    }

    @Transactional
    public void removeSubscription(Integer userId, String endpoint) {
        subRepo.deleteByUserIdAndEndpoint(userId, endpoint);
        log.info("Push subscription removed for user {} endpoint {}", userId, endpoint);
    }

    public void sendToUser(Integer userId, String title, String body, String type, String url) {
        log.info("sendToUser called for userId={}, title={}, type={}", userId, title, type);
        List<PushSubscription> subs = subRepo.findByUserId(userId);
        log.info("Found {} subscriptions for userId={}", subs.size(), userId);
        for (PushSubscription sub : subs) {
            log.info("Sending push to subscription id={} endpoint={}", sub.getId(), sub.getEndpoint().substring(0, 50));
            send(sub, title, body, userId, type, url);
        }
    }

    public void sendToUser(Integer userId, String title, String body) {
        sendToUser(userId, title, body, null, null);
    }

    public void sendToTeam(String team, String title, String body, String type, String url) {
        List<PushSubscription> subs = subRepo.findByTeam(team);
        for (PushSubscription sub : subs) {
            send(sub, title, body, null, type, url);
        }
    }

    public void sendToTeam(String team, String title, String body) {
        sendToTeam(team, title, body, null, null);
    }

    public void sendToAll(String title, String body, String type, String url) {
        List<PushSubscription> subs = subRepo.findAll();
        for (PushSubscription sub : subs) {
            send(sub, title, body, null, type, url);
        }
    }

    public void sendToAll(String title, String body) {
        sendToAll(title, body, null, null);
    }

    private void send(PushSubscription sub, String title, String body, Integer targetUserId, String type, String url) {
        if (pushService == null) {
            log.warn("Push service not initialized, skipping push");
            return;
        }
        try {
            org.json.JSONObject payload = new org.json.JSONObject();
            payload.put("title", title);
            payload.put("body", body);
            if (targetUserId != null) {
                payload.put("userId", targetUserId);
            }
            if (type != null) {
                payload.put("type", type);
            }
            if (url != null) {
                org.json.JSONObject data = new org.json.JSONObject();
                data.put("url", url);
                payload.put("data", data);
            }

            // Parse the subscription public key as a BouncyCastle EC key
            // to avoid the JDK->BC class cast issue in web-push's string constructor.
            org.bouncycastle.jce.interfaces.ECPublicKey userPublicKey = loadUserPublicKey(sub.getP256dh());

            nl.martijndwars.webpush.Notification notification = new nl.martijndwars.webpush.Notification(
                    sub.getEndpoint(),
                    userPublicKey,
                    java.util.Base64.getUrlDecoder().decode(sub.getAuth()),
                    payload.toString().getBytes());

            pushService.send(notification);
        } catch (Exception e) {
            log.warn("Failed to push to endpoint {}: {}", sub.getEndpoint(), e.getMessage());
        }
    }

    private org.bouncycastle.jce.interfaces.ECPublicKey loadUserPublicKey(String p256dhB64)
            throws Exception {
        byte[] raw = java.util.Base64.getUrlDecoder().decode(p256dhB64);
        org.bouncycastle.jce.spec.ECNamedCurveParameterSpec spec = org.bouncycastle.jce.ECNamedCurveTable
                .getParameterSpec("prime256v1");
        org.bouncycastle.math.ec.ECPoint point = spec.getCurve().decodePoint(raw);
        org.bouncycastle.jce.spec.ECPublicKeySpec pubSpec = new org.bouncycastle.jce.spec.ECPublicKeySpec(point, spec);
        var kf = java.security.KeyFactory.getInstance("ECDH", "BC");
        return (org.bouncycastle.jce.interfaces.ECPublicKey) kf.generatePublic(pubSpec);
    }
}
