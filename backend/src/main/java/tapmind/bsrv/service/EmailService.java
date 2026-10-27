package tapmind.bsrv.service;

import org.json.JSONArray;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import tapmind.bsrv.service.Mailer;
import tapmind.bsrv.service.Mailer.Attachment;
import java.util.List;

@Service
public class EmailService {

    @Autowired
    private Mailer mailer;

    @Async("emailExecutor")
    public void sendUserWorkDataEmail(
            String to,
            String subject,
            String body,
            List<Attachment> attachments) {
        try {
            // Convert single email to JSON array internally (if your mailer needs JSON)
            JSONArray toArray = new JSONArray();
            toArray.put(to);

            JSONArray ccArray = new JSONArray(); // empty

            mailer.send(toArray, ccArray, subject, body, attachments);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Async("emailExecutor")
    public void sendTaskEntryMail(
            List<String> toEmails,
            String subject,
            String body) {

        try {

            JSONArray toArray = new JSONArray();

            for (String email : toEmails) {
                if (email != null && !email.isEmpty()) {
                    toArray.put(email);
                }
            }

            JSONArray ccArray = new JSONArray();

            mailer.send(
                    toArray,
                    ccArray,
                    subject,
                    body);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

}
