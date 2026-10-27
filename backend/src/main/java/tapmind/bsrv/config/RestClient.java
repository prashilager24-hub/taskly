package tapmind.bsrv.config;

import java.io.IOException;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHeaders;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.util.EntityUtils;
import org.json.JSONException;
import org.json.JSONObject;
import org.springframework.stereotype.Component;

@Component("configRestClient")
public class RestClient {

    private final CloseableHttpClient httpClient;
    private final RequestConfig requestConfig;

    public RestClient() {
        this.httpClient = HttpClients.createDefault();
        this.requestConfig = RequestConfig.custom()
                .setConnectionRequestTimeout(400000)
                .setConnectTimeout(400000)
                .setSocketTimeout(400000)
                .build();
    }

    public JSONObject httpPost(String url, String strPayLoad) throws IOException, JSONException {
        JSONObject json = new JSONObject();
        json.put("success", false);
        json.put("responseData", "");
        try {
            HttpPost httpRequest = new HttpPost(url);
            HttpEntity stringEntity = new StringEntity(strPayLoad, ContentType.APPLICATION_JSON);
            httpRequest.setEntity(stringEntity);
            httpRequest.setConfig(requestConfig);
            try (CloseableHttpResponse httpResponse = httpClient.execute(httpRequest)) {
                int httpStatus = httpResponse.getStatusLine().getStatusCode();
                json.put("success", httpStatus == 200);
                HttpEntity httpEntity = httpResponse.getEntity();
                if (httpEntity != null) {
                    JSONObject responseBody = new JSONObject(EntityUtils.toString(httpEntity));
                    json.put("responseData", responseBody);
                }
            }
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        return json;
    }

    public JSONObject httpGet(String url) throws IOException, JSONException {
        JSONObject json = new JSONObject();
        json.put("success", false);
        json.put("responseData", "");
        try {
            HttpGet httpGet = new HttpGet(url);
            httpGet.setHeader(HttpHeaders.CONTENT_TYPE, "application/json");
            try (CloseableHttpResponse httpResponse = httpClient.execute(httpGet)) {
                int httpStatus = httpResponse.getStatusLine().getStatusCode();
                json.put("success", httpStatus == 200);
                HttpEntity httpEntity = httpResponse.getEntity();
                if (httpEntity != null) {
                    JSONObject responseBody = new JSONObject(EntityUtils.toString(httpEntity));
                    json.put("responseData", responseBody);
                }
            }
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        return json;
    }
}
