package tapmind.bsrv.service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Iterator;
import java.util.List;
import java.util.ArrayList;
import java.io.*;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Paths;
import org.apache.commons.codec.binary.Base64;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.impl.client.*;
import java.util.Scanner;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import java.util.ArrayList;
import java.util.List;
import org.apache.http.HttpEntity;
import org.apache.http.entity.StringEntity;
import org.apache.http.entity.ByteArrayEntity;
import org.apache.http.entity.ContentType;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.conn.ConnectTimeoutException;
import org.apache.http.HttpHost;
import org.apache.http.util.EntityUtils;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.NameValuePair;
import org.apache.http.message.BasicNameValuePair;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.commons.io.IOUtils;
import tapmind.App;

import org.json.JSONException;
import org.joda.time.DateTime;
import org.joda.time.DateTimeZone;
import java.net.URL;

import java.util.*;

@Service
public class Service_Default {
	public final static java.util.logging.Logger LOGGER = java.util.logging.Logger
			.getLogger(java.util.logging.Logger.GLOBAL_LOGGER_NAME);

	public JSONObject Default() {
		JSONObject json = new JSONObject();
		try {
			json.put("success", true);
			json.put("message", "Default");
		} catch (Exception ex) {
			ex.printStackTrace();
		}
		return json;
	}

	public JSONObject connectOP(String url) throws Exception {

		CloseableHttpClient httpclient = HttpClients.createDefault();
		HttpGet httpget = new HttpGet(url);
		HttpResponse httpresponse = httpclient.execute(httpget);
		Scanner sc = new Scanner(httpresponse.getEntity().getContent());
		StringBuilder s = new StringBuilder();
		while (sc.hasNext()) {
			s.append(sc.nextLine());
		}

		JSONObject json = new JSONObject(s.toString());
		return json;
	}

	// @CircuitBreaker(name = "Connect_OP", fallbackMethod = "connectOPDefault")
	public static JSONObject httpPost(String url, String strPayLoad) throws Exception {
		JSONObject json = new JSONObject();
		json.put("success", false);
		json.put("responseData", "");
		long startTime = System.currentTimeMillis();
		try {
			HttpPost httpRequest = new HttpPost(url);
			HttpEntity stringEntity = new StringEntity(strPayLoad, ContentType.APPLICATION_JSON);
			httpRequest.setEntity(stringEntity);
			RequestConfig requestConfig = RequestConfig.custom()
					.setConnectionRequestTimeout(60000)
					.setConnectTimeout(5000)
					// .setSocketTimeout(600000)
					.build();
			httpRequest.setConfig(requestConfig);
			HttpClientContext httpClientContext = HttpClientContext.create();
			try (CloseableHttpClient httpClient = HttpClients.createDefault();
					CloseableHttpResponse httpResponse = httpClient.execute(httpRequest, httpClientContext)) {
				LOGGER.info("Req forward: " + url);
				long elapsedTime = System.currentTimeMillis() - startTime;
				if (elapsedTime > 60000) {
					json.put("success", false);
					json.put("message", "Response time exceeded 1 minute");
					return json;
				}
				int httpStatus = httpResponse.getStatusLine().getStatusCode();
				json.put("success", (httpStatus == 200) ? true : false);
				HttpEntity httpEntity = httpResponse.getEntity();
				if (httpEntity != null) {
					JSONObject responseBody = new JSONObject(EntityUtils.toString(httpEntity));
					json.put("responseData", responseBody);
				}
			} catch (ConnectTimeoutException ex) {
				ex.printStackTrace();

				json.put("message", ex.getMessage());
			} catch (Exception ex) {
				ex.printStackTrace();
				json.put("message", ex.getMessage());
			}
		} catch (Exception ex) {
			ex.printStackTrace();
			json.put("message", ex.getMessage());
		}
		return json;
	}
/* 
	 using bsrv
	public JSONObject accessPermission(String url, String strPayLoad) throws Exception {
		JSONObject response = new JSONObject();
		boolean access = false;
		response.put("allow", access);
		try {
			JSONObject load = new JSONObject(strPayLoad);
			String role = load.get("userRole").toString();
			LOGGER.info("----------------role--------");
			LOGGER.info(role);

			if (role.equals("Root") || role.equals("SuperAdmin")) {
				response.put("allow", true);
			} else if (role.equals("Admin")) {
				if (url.equals("http://127.0.0.1:2002/v1.0/Companys/create")
						|| url.contains("http://127.0.0.1:2002/v1.0/Companys/update/")
						|| url.contains("http://127.0.0.1:2002/v1.0/Companys/status/") || url.contains("/archive/"))
					response.put("allow", false);

				else
					response.put("allow", true);
			} else {
				if (url.equals("http://1.0.127.130:3048/nativeScrap/scrapUrl"))
					response.put("allow", true);
				else if (url.equals("http://1.0.127.130:3022/upload/uploadFile"))
					response.put("allow", true);
				else if (url.equals("http://127.0.0.1:3022/upload/uploadFile"))
					response.put("allow", true);
				// else
				// if(url.equals("http://127.0.0.1:2003/v1.0/PublihserReport/Revenue/uploadDisplay"))response.put("allow",true);
				else {
					String url1 = url.trim();
					String[] str = url1.split("/");
					System.out.println(str.toString());
					String entity = str[4];
					String resource = str[5];
					LOGGER.info("entity" + entity);
					if (entity.equals("Notifications"))
						response.put("allow", true);
					else {
						try (Connection con = App.getConnection()) {
							String pre1 = "";

							PreparedStatement lstmt1 = con.prepareStatement(
									"SELECT ResourceSuperSet FROM AMResourceActions where ResourceName='" + entity
											+ "'");
							for (ResultSet rs = lstmt1.executeQuery(); rs
									.next(); pre1 = rs.getString("ResourceSuperSet"))
								;

							String pre = "";

							PreparedStatement lstmt = con.prepareStatement(
									"SELECT RolePrivileges FROM AMRole where RoleName='" + role + "'");
							for (ResultSet rs = lstmt.executeQuery(); rs.next(); pre = rs.getString("RolePrivileges"))
								;

							JSONObject req = new JSONObject(pre);
							LOGGER.info("++++++++++++++++++++req++++++++++");
							LOGGER.info(req.toString());
							if (req.has(pre1)) {
								JSONObject req1 = req.getJSONObject(pre1);
								if (req1.has(entity)) {
									LOGGER.info(entity);
									JSONObject innerjson = req1.getJSONObject(entity);
									if (innerjson.has(resource)) {
										LOGGER.info(resource);
										access = innerjson.getBoolean(resource);
									} else {
										access = true;
									}
								}
							} else
								access = true;
							response.put("allow", access);
							con.close();
						} catch (Exception e) {
							e.printStackTrace();
							response.put("allow", access);
						}
					}

				}
			}
		} catch (JSONException e) {
			response.put("allow", access);
			response.put("message", "UserRole Not Found");
		}
		return response;
	}

	/*
	 * public void logdDataToMongoDB(int userID,String userRole,int companyID,String
	 * resourceURL,String resourceType,String resourceName,String
	 * resourceAction,boolean Status){
	 * 
	 * try{
	 * LocalDate date = DateTime.now().toLocalDate();
	 * LocalTime time = DateTime.now().toLocalTime();
	 * MongoCollection collection=App.mongoDb();
	 * Document document1 = new Document("userID", userID)
	 * .append("userRole", userRole)
	 * .append("companyID", companyID)
	 * .append("resourceURL", resourceURL)
	 * .append("resourceName", resourceName)
	 * .append("resourceAction", resourceAction)
	 * .append("status", Status)
	 * .append("date",date.toString())
	 * .append("time",time.toString())
	 * .append("resourceType", resourceType);
	 * List<Document> list = new ArrayList<Document>();
	 * list.add(document1);
	 * collection.insertMany(list);
	 * 
	 * }
	 * catch(Exception e){
	 * e.printStackTrace();
	 * }
	 * 
	 * }
	 */

	public static JSONObject httpPost1(String url, String strPayLoad) throws Exception {
		JSONObject json = new JSONObject();
		json.put("success", false);
		json.put("responseData", "");
		try {
			HttpPost httpRequest = new HttpPost(url);
			HttpEntity stringEntity = new StringEntity(strPayLoad, ContentType.APPLICATION_JSON);
			httpRequest.setEntity(stringEntity);
			RequestConfig requestConfig = RequestConfig.custom()
					.setConnectionRequestTimeout(600000)
					.setConnectTimeout(600000)
					.setSocketTimeout(600000)
					.build();
			httpRequest.setConfig(requestConfig);
			HttpClientContext httpClientContext = HttpClientContext.create();
			try (CloseableHttpClient httpClient = HttpClients.createDefault();
					CloseableHttpResponse httpResponse = httpClient.execute(httpRequest, httpClientContext)) {
				int httpStatus = httpResponse.getStatusLine().getStatusCode();
				json.put("success", (httpStatus == 200) ? true : false);
				HttpEntity httpEntity = httpResponse.getEntity();
				if (httpEntity != null) {
					JSONArray array = new JSONArray(EntityUtils.toString(httpEntity));
					JSONObject responseBody = new JSONObject();
					responseBody.put("response", array);
					json.put("responseData", responseBody);
				}
			} catch (Exception ex) {
				ex.printStackTrace();
			}
		} catch (Exception ex) {
			ex.printStackTrace();
		}
		return json;
	}

	public static JSONObject sendBulkMail(JSONObject js) throws Exception {
		try {
			String email = js.getString("email");
			String password = js.getString("password");
			String partnerName = js.getString("partnerName");
			JSONArray to = new JSONArray();
			JSONArray cc = new JSONArray();
			to.put(email);
			StringBuffer body = new StringBuffer();
			body.append("<p>");
			body.append("<p> Dear " + partnerName + " </p>");
			body.append("<p >Welcome to Bidsxchange.</p>");
			body.append(
					"<p >A trusted Ad Revenue Monetization platform for online publishers. We're happy to partner with you.</p>");
			body.append("<p> Your account is almost complete; to set a password, please click the link <a href="
					+ password + " target='_blank' style='width:60%;  color:blue;'>Click here</a></p> ");
			body.append("<p> This password reset link is only valid for the next 30 minutes.</p>");
			body.append(
					"<p>Bidsxchange helps publishers like you double revenue through: High-Impact Ad Formats: With our unique ad formats, publishers like you can improve eCPMs and enhance the viewability of ads. Display & Video Adserver- With Bidsxchange's customized display and video ads, publishers can cost-effectively reach their target audiences</p>");
			body.append(
					"Multi-Lingual Video Content- We design high-quality videos for publishers' blogs and websites that guarantee maximum viewability."
							+
							" Bidsxchange has a lot of offerings for publishers to increase their revenue, including innovative ad formats, web stories, and creative video content. In addition, we offer publishers a single dashboard where they can access all your data at once.</p>");
			body.append(
					"<p>Thank you for choosing Bidsxchange, and we look forward to working with you and making our partnership a huge success</p>");
			body.append("</p>");
			String subject = "Welcome to Bidsxchange platform ";
			Mailer MAILER = new Mailer();
			MAILER.send(to, cc, subject, body.toString());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return js;
	}

	public static JSONObject sendWelcomeMail(JSONObject js) throws Exception {
		try {
			String email = js.getString("email");
			String partnerName = js.getString("partnerName");
			JSONArray to = new JSONArray();
			JSONArray cc = new JSONArray();
			to.put(email);
			StringBuffer body = new StringBuffer();
			body.append("<p>");
			body.append("<p> Dear " + partnerName + " </p>");
			body.append("<p >Welcome to Bidsxchange.</p>");
			body.append(
					"<p >A trusted Ad Revenue Monetization platform for online publishers. We're happy to partner with you.</p>");
			body.append(
					"<p>Bidsxchange helps publishers like you double revenue through: High-Impact Ad Formats: With our unique ad formats, publishers like you can improve eCPMs and enhance the viewability of ads. Display & Video Adserver- With Bidsxchange's customized display and video ads, publishers can cost-effectively reach their target audiences</p>");
			body.append(
					"Multi-Lingual Video Content- We design high-quality videos for publishers' blogs and websites that guarantee maximum viewability."
							+
							" Bidsxchange has a lot of offerings for publishers to increase their revenue, including innovative ad formats, web stories, and creative video content. In addition, we offer publishers a single dashboard where they can access all your data at once.</p>");
			body.append(
					"<p>Thank you for choosing Bidsxchange, and we look forward to working with you and making our partnership a huge success</p>");
			body.append("</p>");
			String subject = "Welcome to Bidsxchange platform ";
			Mailer MAILER = new Mailer();
			MAILER.send(to, cc, subject, body.toString());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return js;
	}

	public static JSONObject sendMailforError(JSONObject js) throws Exception {
		JSONObject js1 = new JSONObject();
		js1.put("success", false);
		try {
			String url = js.getString("path");
			String message = js.getString("message");
			JSONArray to = new JSONArray();
			JSONArray cc = new JSONArray();
			to.put("vasu.madhavarapu@tapmind.com");
			StringBuffer body = new StringBuffer();
			body.append("<p>");
			body.append("<p> There  is error in the sytsem </p>");
			body.append("<p >With the API URL " + url + "</p>");
			body.append("<p> with error message" + message + "</p>");

			String subject = "Error in the sytem  ";
			Mailer MAILER = new Mailer();
			MAILER.send(to, cc, subject, body.toString());
			js1.put("success", true);
		} catch (Exception e) {
			e.printStackTrace();
		}
		return js1;
	}

	public static JSONObject httpPostPartner(String url, String strPayLoad) throws Exception {
		JSONObject json = new JSONObject();
		json.put("success", false);
		json.put("responseData", "");
		try {
			HttpPost httpRequest = new HttpPost(url);
			HttpEntity stringEntity = new StringEntity(strPayLoad, ContentType.APPLICATION_JSON);
			httpRequest.setEntity(stringEntity);
			RequestConfig requestConfig = RequestConfig.custom()
					.setConnectionRequestTimeout(60000)
					.setConnectTimeout(5000)
					// .setSocketTimeout(60000)
					.build();
			httpRequest.setConfig(requestConfig);
			HttpClientContext httpClientContext = HttpClientContext.create();
			try (CloseableHttpClient httpClient = HttpClients.createDefault();
					CloseableHttpResponse httpResponse = httpClient.execute(httpRequest, httpClientContext)) {
				int httpStatus = httpResponse.getStatusLine().getStatusCode();
				LOGGER.info("-----------httpStatus----------" + httpStatus);
				json.put("success", (httpStatus == 200) ? true : false);
				HttpEntity httpEntity = httpResponse.getEntity();
				if (httpEntity != null) {
					JSONObject responseBody = new JSONObject(EntityUtils.toString(httpEntity));
					json.put("responseData", responseBody);
				}
			} catch (Exception ex) {
				ex.printStackTrace();
				json.put("message", ex.getMessage());
			}
		} catch (Exception ex) {
			ex.printStackTrace();
			json.put("message", ex.getMessage());
		}
		return json;
	}

	// Partner Role privilages
	/*public JSONObject partnerAccessPermission(String url, String strPayLoad) throws Exception {
		JSONObject response = new JSONObject();
		boolean access = true;
		response.put("allow", access);
		try {
			JSONObject load = new JSONObject(strPayLoad);
			String role = load.get("userRole").toString();
			String userID = load.get("userID").toString();
			LOGGER.info("----------------role--------");
			LOGGER.info(role);
			LOGGER.info("----------------url--------");
			LOGGER.info(url);
			String url1 = url.trim();
			String[] str = url1.split("/");
			String entity = str[4];
			String resource = str[5];
			LOGGER.info("entity" + entity);
			// if(entity.equals("Notifications"))response.put("allow",true);
			// else{
			try (Connection con = App.getConnection()) {
				String pre1 = "";
				// String querysuperset ="SELECT ResourceSuperSet FROM AMResourceActions where
				// ResourceName="+entity;
				// LOGGER.info("querysuperset"+querysuperset);
				// PreparedStatement lstmt1 = con.prepareStatement("SELECT ResourceSuperSet FROM
				// AMResourceActions where ResourceName='" + entity + "'");
				// for (ResultSet rs = lstmt1.executeQuery(); rs.next(); pre1 =
				// rs.getString("ResourceSuperSet"));

				String pre = "";
				String RolePrivileges = "SELECT PartnerRolePrivilages FROM PartnerProfiles where PartnerID=" + userID;
				LOGGER.info("RolePrivileges" + RolePrivileges);
				PreparedStatement lstmt = con.prepareStatement(
						"SELECT PartnerRolePrivilages FROM PartnerProfiles where PartnerID='" + userID + "'");
				ResultSet resp = lstmt.executeQuery();
				while (resp.next()) {
					JSONObject privileges = new JSONObject(resp.getString("PartnerRolePrivilages"));

					Set<String> demandAccessEntities = new HashSet<>(Arrays.asList(
							"Advertisers", "IOGroups", "IOs", "LineItems", "HeaderBidding", "TC", "Creatives"));

					Set<String> supplyAccessEntities = new HashSet<>(Arrays.asList(
							"Publishers", "ChildAdUnits", "STDBSettings", "PlayerSettings", "AdUnits", "AdUnitGroups",
							"HighImpactSettings"));

					if (demandAccessEntities.contains(entity)) {
						if (!privileges.getBoolean("isDemandAccess")) {
							access = false;
						}
					} else if (supplyAccessEntities.contains(entity)) {
						if (!privileges.getBoolean("isSupplyAccess")) {
							access = false;
						}
					} else {
						access = true;
					}

					// for (ResultSet rs = lstmt.executeQuery(); rs.next(); pre =
					// rs.getString("PartnerRolePrivilages"));

					// JSONObject req=new JSONObject(pre);
					// if(entity.equals("Advertisers")){
					// if (!privileges.getBoolean("isDemandAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("IOGroups")){
					// if (!privileges.getBoolean("isDemandAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("IOs")){
					// if (!privileges.getBoolean("isDemandAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("LineItems")){
					// if (!privileges.getBoolean("isDemandAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("HeaderBidding")){
					// if (!privileges.getBoolean("isDemandAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("TC")){
					// if (!privileges.getBoolean("isDemandAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("Creatives")){
					// if (!privileges.getBoolean("isDemandAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("Publishers")){
					// if (!privileges.getBoolean("isSupplyAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("ChildAdUnits")){
					// if (!privileges.getBoolean("isSupplyAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("STDBSettings")){
					// if (!privileges.getBoolean("isSupplyAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("PlayerSettings")){
					// if (!privileges.getBoolean("isSupplyAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("AdUnits")){
					// if (!privileges.getBoolean("isSupplyAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("AdUnitGroups")){
					// if (!privileges.getBoolean("isSupplyAccess")) {
					// access=false;
					// }
					// }
					// else if(entity.equals("HighImpactSettings")){
					// if (!privileges.getBoolean("isSupplyAccess")) {
					// access=false;
					// }
					// }

					// else{
					// access=true;
					// }
				}
				// else if(entity=='Publishers'){
				// if (!privileges.getBoolean("isPublisherAccess")) {
				// access=false;
				// }
				// }
				// else if(entity=='LineItems'){
				// if (!privileges.getBoolean("isLineItemAccess")) {
				// access=false;
				// }
				// }

				// LOGGER.info("==============JSONObject req=new
				// JSONObject(pre);=================");
				// LOGGER.info(req.toString());
				// LOGGER.info("==============pre1.toString()===============");
				// LOGGER.info(pre1.toString());
				// if(req.has(pre1)){
				// LOGGER.info("==============req.has(pre1)=================");
				// LOGGER.info(pre1.toString());
				// JSONObject req1=req.getJSONObject(pre1);
				// if (req1.has(entity)) {
				// LOGGER.info("===============req1.has(entity)==================");
				// LOGGER.info(entity);
				// JSONObject innerjson = req1.getJSONObject(entity);
				// if(innerjson.has(resource)) {
				// LOGGER.info("--------resource------");
				// LOGGER.info(resource);
				// access=innerjson.getBoolean(resource);
				// }
				// else {
				// access=true;
				// }
				// }
				// }
				// else access=false;
				response.put("allow", access);
				con.close();
			} catch (Exception e) {
				e.printStackTrace();
				response.put("allow", access);
			}

		} catch (JSONException e) {
			response.put("allow", access);
			response.put("message", "UserRole Not Found");
		}
		return response;
	}
*/
	// circuit breaker
	public static JSONObject connectOPDefault(String url, String strPayLoad) throws Exception {
		JSONObject res = new JSONObject();
		res.put("response", "the service failed to respond on service: " + url);
		return res;
	}
}