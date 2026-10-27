
package tapmind.bsrv.service;
import java.util.Properties;
import javax.activation.DataHandler;
import javax.activation.DataSource;

import javax.mail.Address;
import javax.mail.BodyPart;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.Multipart;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;
import javax.mail.util.ByteArrayDataSource;

import org.joda.time.DateTime;
import org.joda.time.DateTimeZone;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.Files;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

import java.io.BufferedReader;
import java.io.IOException;

import java.util.List;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.json.JSONArray;
import org.springframework.stereotype.Component;

@Component
public class Mailer {
	public static final Logger LOGGER = LogManager.getLogger(Mailer.class);
  private static String emailTemplate="";
  static {

      Charset utf8=StandardCharsets.UTF_8;
	  Path pathToEmailTemplateFile=Paths.get("/authentificationUtilization/templates/email-template.html");
    //  Path pathToEmailTemplateFile=Paths.get("/home/ubuntu/docker/java/Utilization/authentificationUtilization/authentificationUtilization/authentificationUtilization/email-template.html");
	  try {
		byte[] content=Files.readAllBytes(pathToEmailTemplateFile);
		emailTemplate=new String(content);
	  } catch(IOException ex) {
		  ex.printStackTrace();
	  }
  }
	 /* Charset utf8=StandardCharsets.UTF_8;
	  Path pathToEmailTemplateFile=Paths.get("C:\\Users\\shwet\\OneDrive\\Projects\\newdb\\pull\\authentification\\email-template.html");
	  try {
		byte[] content=Files.readAllBytes(pathToEmailTemplateFile);
		emailTemplate=new String(content);
	  } catch(IOException ex) {
		  ex.printStackTrace();
	  }
  }*/



  public boolean send(JSONArray to, JSONArray cc, String subject, String body) throws Exception{
    String emailHost = "smtp.gmail.com";
    String from = "no-reply@tapmind.com";
    String username = "noreply@tapmind.com";
    String password = "hwsz vnmt ggdv kebj";
    LOGGER.info(password);
    Properties emailProperties = System.getProperties();
    emailProperties.put("mail.smtp.port", "587");
    emailProperties.put("mail.smtp.auth", "true");
    emailProperties.put("mail.smtp.starttls.enable", "true");
    Session mailSession = Session.getDefaultInstance(emailProperties, null);
    try {
      MimeMessage mimeMessage = new MimeMessage(mailSession);
      mimeMessage.setFrom((Address)new InternetAddress(from));

	  for(int i=0;i<to.length();++i) {
		mimeMessage.addRecipient(Message.RecipientType.TO,(Address)new InternetAddress(to.getString(i)));
	  }
	  for(int i=0;i<cc.length();++i) {
		  mimeMessage.addRecipient(Message.RecipientType.CC,(Address)new InternetAddress(cc.getString(i)));
	  }

      mimeMessage.setSubject(subject);
      mimeMessage.setContent(emailTemplate.replace("{CONTENT}", body), "text/html");
      Transport transport = mailSession.getTransport("smtp");
      transport.connect(emailHost, username, password);
      transport.sendMessage((Message)mimeMessage, mimeMessage.getAllRecipients());
      transport.close();
      return true;
    } catch (MessagingException mex) {
      mex.printStackTrace();
      return false;
    } 
  }
  public boolean send(JSONArray to, JSONArray cc, String subject, String body, String fileName, String contentType, byte[] content) {
    String emailHost = "smtp.gmail.com";
    String from = "no-reply@tapmind.com";
    String username = "noreply@tapmind.com";
    String password = "hwsz vnmt ggdv kebj";
    Properties emailProperties = System.getProperties();
    emailProperties.put("mail.smtp.port", "587");
    emailProperties.put("mail.smtp.auth", "true");
    emailProperties.put("mail.smtp.starttls.enable", "true");
    Session mailSession = Session.getDefaultInstance(emailProperties, null);
    try {
      MimeMessage mimeMessage = new MimeMessage(mailSession);
      mimeMessage.setFrom((Address)new InternetAddress(from));
			for(int i=0;i<to.length();++i) mimeMessage.addRecipient(Message.RecipientType.TO,(Address)new InternetAddress(to.getString(i)));
			for(int i=0;i<cc.length();++i) mimeMessage.addRecipient(Message.RecipientType.CC,(Address)new InternetAddress(cc.getString(i)));

			mimeMessage.setSubject(subject);
			MimeBodyPart mimeBodyPart = new MimeBodyPart();
			mimeBodyPart.setContent(emailTemplate.replace("{CONTENT}",body),"text/html");
			MimeMultipart mimeMultipart = new MimeMultipart();
			mimeMultipart.addBodyPart((BodyPart)mimeBodyPart);
			mimeBodyPart = new MimeBodyPart();
			ByteArrayDataSource byteArrayDataSource = new ByteArrayDataSource(content,contentType);
			mimeBodyPart.setDataHandler(new DataHandler((DataSource)byteArrayDataSource));
			mimeBodyPart.setHeader("Content-Type", contentType);
			mimeBodyPart.setFileName(fileName);
			mimeMultipart.addBodyPart((BodyPart)mimeBodyPart);
			mimeMessage.setContent((Multipart)mimeMultipart);
			Transport transport = mailSession.getTransport("smtp");
			transport.connect(emailHost, username, password);
			transport.sendMessage((Message)mimeMessage, mimeMessage.getAllRecipients());
			transport.close();
			return true;
    } catch (MessagingException mex) {
      mex.printStackTrace();
      return false;
    } catch (Exception ioex) {
      return false;
    } 
  }
	
	public static class Attachment {
		public String fileName;
		public String contentType;
		public byte[] content;
	}
	
  public boolean send(JSONArray to, JSONArray cc, String subject, String body, List<Attachment> attachments) {
    String emailHost = "smtp.gmail.com";
    String from = "no-reply@tapmind.com";
    String username = "noreply@tapmind.com";
     String password = "hwsz vnmt ggdv kebj";
    Properties emailProperties = System.getProperties();
    emailProperties.put("mail.smtp.port", "587");
    emailProperties.put("mail.smtp.auth", "true");
    emailProperties.put("mail.smtp.starttls.enable", "true");
    Session mailSession = Session.getDefaultInstance(emailProperties, null);
    try {
      MimeMessage mimeMessage = new MimeMessage(mailSession);
      mimeMessage.setFrom((Address)new InternetAddress(from));
			for(int i=0;i<to.length();++i) mimeMessage.addRecipient(Message.RecipientType.TO,(Address)new InternetAddress(to.getString(i)));
			for(int i=0;i<cc.length();++i) mimeMessage.addRecipient(Message.RecipientType.CC,(Address)new InternetAddress(cc.getString(i)));

      mimeMessage.setSubject(subject);
      MimeBodyPart mimeBodyPart=new MimeBodyPart();
      mimeBodyPart.setContent(emailTemplate.replace("{CONTENT}",body),"text/html");
      MimeMultipart mimeMultipart=new MimeMultipart();
      mimeMultipart.addBodyPart((BodyPart)mimeBodyPart);
			
			for(Attachment attachment:attachments) {
				mimeBodyPart=new MimeBodyPart();
				ByteArrayDataSource byteArrayDataSource=new ByteArrayDataSource(attachment.content,attachment.contentType);
				mimeBodyPart.setDataHandler(new DataHandler((DataSource)byteArrayDataSource));
				mimeBodyPart.setHeader("Content-Type",attachment.contentType);
				mimeBodyPart.setFileName(attachment.fileName);
				mimeMultipart.addBodyPart((BodyPart)mimeBodyPart);
			}

      mimeMessage.setContent((Multipart)mimeMultipart);
      Transport transport = mailSession.getTransport("smtp");
      transport.connect(emailHost, username, password);
      transport.sendMessage((Message)mimeMessage, mimeMessage.getAllRecipients());
      transport.close();
      return true;
    } catch (MessagingException mex) {
      mex.printStackTrace();
      return false;
    } catch (Exception ioex) {
      return false;
    } 
  }
	
}
