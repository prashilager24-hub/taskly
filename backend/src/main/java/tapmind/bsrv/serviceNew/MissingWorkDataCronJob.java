
package tapmind.bsrv.serviceNew;
import java.time.LocalDate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tapmind.bsrv.dto.*;
import java.util.List;
import java.time.DayOfWeek;
import org.json.JSONArray;
import tapmind.bsrv.service.Mailer;
@Component
public class MissingWorkDataCronJob {

    private final JwtUserService userService;


    public MissingWorkDataCronJob(JwtUserService userService) {
        this.userService = userService;
       
    }

    @Scheduled(cron = "0 0 9 * * ?") // everyday 9 AM
public void sendMissingWorkDataUsersMail() {

    LocalDate targetDate = LocalDate.now().minusDays(1); // yesterday

     DayOfWeek dayOfWeek = targetDate.getDayOfWeek();

    // Skip Saturday & Sunday
    if (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) {
        System.out.println("Weekend. No mail sent.");
        return;
    }

    List<MissingWorkDataUserDTO> users =
            userService.getUsersWhoDidNotFillData(targetDate, targetDate);

    if (users.isEmpty()) {
        System.out.println("No missing users for date: " + targetDate);
        return;
    }

    // Send individual mails
    for (MissingWorkDataUserDTO user : users) {
        sendMailToUser(user, targetDate);
    }
}



     public void sendMailToUser(MissingWorkDataUserDTO user, LocalDate targetDate) {

    Mailer MAILER = new Mailer();

    try {
        JSONArray to = new JSONArray();
        to.put(user.getUserEmail());   // single user

        JSONArray cc = new JSONArray(); // no CC

        String subject = "Reminder: Please fill your work data for " + targetDate.toString();

        StringBuilder body = new StringBuilder();

        body.append("<p>Hi ").append(user.getUserName()).append(",</p>");

        body.append("<p>This is a gentle reminder to fill your work data for <b>")
            .append(targetDate.toString())
            .append("</b>.</p>");

        body.append("<p>Please login to the system and update your work details at the earliest.</p>");

        body.append("<p><b>Note:</b> This is an automated reminder email.</p>");

        body.append("<p>Thank you,<br/>TapMind Team</p>");

        MAILER.send(to, cc, subject, body.toString());

    } catch (Exception e) {
        e.printStackTrace();
    }
}


 
}
