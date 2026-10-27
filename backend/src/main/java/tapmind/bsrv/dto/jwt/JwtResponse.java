// package tapmind.bsrv.dto.jwt;
// import java.io.Serializable;

// public class JwtResponse implements Serializable {

// 	private static final long serialVersionUID = -8091879091924046844L;
// 	private final String jwttoken;

// 	public JwtResponse(String jwttoken) {
// 		this.jwttoken = jwttoken;
// 	}

// 	public String getToken() {
// 		return this.jwttoken;
// 	}
// }

package tapmind.bsrv.dto.jwt;

import java.io.Serializable;

public class JwtResponse implements Serializable {

	private static final long serialVersionUID = -8091879091924046844L;

	private final String jwttoken;

	private Integer reportingManagerID;

	private Integer elManagerID;

	public JwtResponse(
			String jwttoken,
			Integer reportingManagerID,
			Integer elManagerID) {

		this.jwttoken = jwttoken;
		this.reportingManagerID = reportingManagerID;
		this.elManagerID = elManagerID;
	}

	public String getToken() {
		return this.jwttoken;
	}

	public Integer getReportingManagerID() {
		return reportingManagerID;
	}

	public void setReportingManagerID(Integer reportingManagerID) {
		this.reportingManagerID = reportingManagerID;
	}

	public Integer getElManagerID() {
		return elManagerID;
	}

	public void setElManagerID(Integer elManagerID) {
		this.elManagerID = elManagerID;
	}
}