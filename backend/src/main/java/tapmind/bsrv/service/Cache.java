package tapmind.bsrv.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Date;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;
import tapmind.App;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Iterator;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import javax.persistence.Query;
import org.springframework.transaction.annotation.Transactional;
import tapmind.App;
import org.joda.time.DateTime;
@Service
@Transactional
public class Cache {
	Logger LOGGER = LogManager.getLogger(Cache.class);


	/*
	public JSONObject getEffectedSupply(int id, String selectClause) {
		JSONObject json1 = new JSONObject();
			try(Connection con=App.getConnection()) 
			{
			String getQuery="select Users.UserID,Users.UserName,Users.UserStatus,Users.IsUserArchived,Users.UserCreateTime,Users.UserBusinessName,Users.UserContactName,Users.UserAddress,Users.UserContactEmail,"+
					 " Users.UserContactPhone,Users.UserCityOrTown,Users.UserProvinceOrStateOrRegion,Users.UserZipCode,Users.UserCountry,Users.UserRole, "+
					 " Publishers.PublisherID,Publishers.PublisherName,Publishers.PublisherSite,Publishers.PublisherStatus,Publishers.IsPublisherArchived,Publishers.PublisherCreateTime,"+
 					 " AdUnits.AdUnitID,AdUnits.AdUnitName,AdUnits.AdUnitStatus,AdUnits.AdUnitSize,AdUnits.IsAdUnitArchived,AdUnits.AdUnitCreateTime FROM Users INNER JOIN Publishers on Users.UserID=Publishers.UserID "+
      				 "  INNER JOIN AdUnits ON AdUnits.PublisherID=Publishers.PublisherID where "+ selectClause +id;
               LOGGER.info(getQuery);
			  PreparedStatement stmt = con.prepareStatement(getQuery);
			ResultSet rs = stmt.executeQuery();
			JSONArray jsonarray = new JSONArray();

			while(rs.next()){
				JSONObject json = new JSONObject();
				
				json.put("UserID", rs.getString("UserID"));
				json.put("UserName", rs.getString("UserName"));
				json.put("UserStatus", rs.getString("UserStatus"));
				json.put("IsUserArchived", rs.getString("IsUserArchived"));
				json.put("UserCreateTime", rs.getString("UserCreateTime"));
				json.put("UserBusinessName", rs.getString("UserBusinessName"));
				json.put("UserContactName", rs.getString("UserContactName"));
				json.put("UserAddress", rs.getString("UserAddress"));
				json.put("UserContactEmail", rs.getString("UserContactEmail"));
				json.put("UserContactPhone", rs.getString("UserContactPhone"));
				json.put("UserCityOrTown", rs.getString("UserCityOrTown"));
				json.put("UserProvinceOrStateOrRegion", rs.getString("UserProvinceOrStateOrRegion"));
				json.put("UserZipCode", rs.getString("UserZipCode"));
				json.put("UserCountry", rs.getString("UserCountry"));
				json.put("UserRole", rs.getString("UserRole"));
				json.put("PublisherID", rs.getString("PublisherID"));
				json.put("PublisherName", rs.getString("PublisherName"));
				json.put("PublisherSite", rs.getString("PublisherSite"));
				json.put("PublisherStatus", rs.getString("PublisherStatus"));
				json.put("IsPublisherArchived", rs.getString("IsPublisherArchived"));
				json.put("PublisherCreateTime", rs.getString("PublisherCreateTime"));
				json.put("AdUnitID", rs.getString("AdUnitID"));
				json.put("AdUnitName", rs.getString("AdUnitName"));
				json.put("AdUnitStatus", rs.getString("AdUnitStatus"));
				json.put("AdUnitSize", rs.getString("AdUnitSize"));
				json.put("IsAdUnitArchived", rs.getString("IsAdUnitArchived"));
                json.put("AdUnitCreateTime", rs.getString("AdUnitCreateTime"));


					jsonarray.put(json);
			}
			json1.put("response", jsonarray);
			LOGGER.info(json1.toString());
} catch (Exception e) {
			e.printStackTrace();
		}
		return json1;
	}*/
	public String dateFormater(String dates){
		String date=dates.split(" ")[0];
		String ldate = DateTime.parse(date).toString("dd-MM-yyyy");
		return ldate;

	}
}