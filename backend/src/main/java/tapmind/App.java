package tapmind;

import org.springframework.boot.web.servlet.ServletContextInitializer;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.SessionCookieConfig;
import jakarta.servlet.SessionTrackingMode;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.boot.web.servlet.ServletComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.context.annotation.Bean;
import java.sql.*;
import org.springframework.scheduling.annotation.Scheduled;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.json.JSONObject;
import org.json.JSONArray;
import org.springframework.orm.hibernate5.LocalSessionFactoryBean;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;//StandardCharsets.ISO_8859_1
import java.io.*;
import org.joda.time.DateTime;
import org.joda.time.DateTimeZone;
import java.util.Date;
import java.util.Calendar;
import java.util.Date;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;
import java.util.Iterator;
//import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class App {

	public static final Logger LOGGER = LogManager.getLogger(App.class);

	public static void main(String args[]) {
		SpringApplication.run(App.class, args);
	}

}