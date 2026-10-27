package tapmind.bsrv.serviceNew;

import tapmind.bsrv.model.ForgotPassword;
import tapmind.bsrv.repository.ForgotPasswordRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ForgotPasswordSchedulerService {

    private final ForgotPasswordRepository forgotPasswordRepository;

    public ForgotPasswordSchedulerService(ForgotPasswordRepository forgotPasswordRepository) {
        this.forgotPasswordRepository = forgotPasswordRepository;
    }

   @Transactional
    @Scheduled(fixedRate = 300000) // every 5 minutes
    public void markExpiredTokens() {
        Date now = new Date(); // <-- using java.util.Date
        List<ForgotPassword> expiredTokens = forgotPasswordRepository.findExpiredTokens(now);

        if (!expiredTokens.isEmpty()) {
            expiredTokens.forEach(token -> token.setStatus(true));
            forgotPasswordRepository.saveAll(expiredTokens);
            System.out.println("Expired tokens updated: " + expiredTokens.size());
        }
    }
}
