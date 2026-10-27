package tapmind.bsrv.Log;

import org.json.JSONException;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import tapmind.bsrv.config.RestClient;

import java.util.concurrent.CompletableFuture;

@Service
public class LogingService {
    

    private final RestClient restClient;

    @Autowired
    public LogingService(@Qualifier("configRestClient") RestClient restClient) {
        this.restClient = restClient;
    }
 
 
    public  void Matserlog(String entityName, String entityValue, String user, String role, String action, Boolean success, String details) throws JSONException {
        JSONObject finalValue = new JSONObject();
        finalValue.put("entity_name", entityName);
        finalValue.put("entity_value", entityValue);
        finalValue.put("user", user);
        finalValue.put("role", role);
        finalValue.put("action", action);
        finalValue.put("success", success);
        finalValue.put("details", details);

        CompletableFuture.runAsync(() -> {
            try {
                restClient.httpPost("http://10.0.3.47:2007/master/create", finalValue.toString());
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    public  void Partnerlog(String entityName, String entityValue, String user, String role, String action, Boolean success, String details) throws JSONException {
        JSONObject finalValue = new JSONObject();
        finalValue.put("entity_name", entityName);
        finalValue.put("entity_value", entityValue);
        finalValue.put("user", user);
        finalValue.put("role", role);
        finalValue.put("action", action);
        finalValue.put("success", success);
        finalValue.put("details", details);

        CompletableFuture.runAsync(() -> {
            try {
                restClient.httpPost("http://10.0.3.47:2007/partner/create", finalValue.toString());
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

     

}
