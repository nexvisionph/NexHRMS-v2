using System;
using System.Collections.Generic;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Data.SqlClient;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.IO;
using FKWeb;
using System.Data;
using System.Configuration;

public partial class LogManager : System.Web.UI.Page
{
    FKWebDB m_db;
    string mDevId;
    int nCount = 0;
    protected void Page_Load(object sender, EventArgs e)
    {
        mDevId = (string)Session["dev_id"];
        DevID.Text = mDevId;
        Version.Text = ConfigurationManager.AppSettings["Version"];

        if (m_db == null) m_db = new FKWebDB();
        
        gvLog.AllowPaging = true;
        gvLog.PageSize = 20;

        if (BeginDate.Text.Length == 0) BeginDate.Text = FKWebTools.TimeToString(DateTime.Now, 1);
        if (EndDate.Text.Length == 0) EndDate.Text = FKWebTools.TimeToString(DateTime.Now, 2);

        ViewState["SortExpression"] = "io_time ASC";
        
        BindGridView();
    }

    private void BindGridView()
    {
        try
        {
            
            string mTransid = mTransIdTxt.Text;

            int status;
            string sCommand = "";
            string sParam = "";
            string sCmdResult = "";

            if (m_db == null) m_db = new FKWebDB();
            if (m_db.GetCommand(mTransid, out sCommand, out sParam, out status, out sCmdResult) == false) 
                return;

            string sBeginDate = "";
            string sEndDate = "";

            if (sParam.Length > 0)
            {
                JObject jobjLogInfo = JObject.Parse(sParam);
                if (sParam.Contains("begin_time") == true)
                {
                    sBeginDate = jobjLogInfo["begin_time"].ToString();
                    sBeginDate = FKWebTools.ConvertFKTimeToNormalTimeString(sBeginDate);
                    BeginDate.Text = sBeginDate;
                }
                if (sParam.Contains("end_time") == true)
                {
                    sEndDate = jobjLogInfo["end_time"].ToString();
                    sEndDate = FKWebTools.ConvertFKTimeToNormalTimeString(sBeginDate);
                    EndDate.Text = sEndDate;
                }
            }

            DataSet dsLog = new DataSet();


            string sSql = "SELECT * FROM tbl_log where dev_id = '" + mDevId + "'";
            if (sBeginDate.Length > 0) sSql += " and io_time>='" + sBeginDate + "'";
            if (sEndDate.Length > 0) sSql += " and io_time<='" + sEndDate + "'";
            if (m_db == null) m_db = new FKWebDB();
            SqlDataAdapter da = m_db.SetSQLDataAdapter(sSql);
            // conn.Open();
            da.Fill(dsLog, "tbl_log");
                
            DataView dvLog = dsLog.Tables["tbl_log"].DefaultView;
                
            gvLog.DataSource = dvLog;
            gvLog.DataBind();
			nCount = dvLog.Count;
            //nPageCount = gvLog.PageCount;
            //gvLog.PageIndex = nPageCount - 1;
                
            StatusTxt.Text = "       Total Count : " + Convert.ToString(nCount) + "&nbsp;&nbsp;&nbsp; Current Time :" + DateTime.Now.ToString("HH:mm:ss tt");
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }

    }

    protected void gvLog_PageIndexChanging(object sender, GridViewPageEventArgs e)
    {
        // Set the index of the new display page.  
        gvLog.PageIndex = e.NewPageIndex;


        // Rebind the GridView control to  
        // show data in the new page. 
        BindGridView();
    }


    protected void goback_Click(object sender, EventArgs e)
    {
        Response.Redirect("Default.aspx");
    }
    protected void GetLogBtn_Click(object sender, EventArgs e)
    {
        string sBeginDate = BeginDate.Text;
        string sEndDate = EndDate.Text;
        JObject vResultJson = new JObject();
        DateTime dtBegin, dtEnd;
        try
        {
            if (sBeginDate.Length > 0)
            {
                dtBegin = Convert.ToDateTime(sBeginDate);
                sBeginDate = FKWebTools.GetFKTimeString14(dtBegin);
                vResultJson.Add("begin_time", sBeginDate);
            }
              
            if (sEndDate.Length > 0)
            {
                dtEnd = Convert.ToDateTime(sEndDate);
                sEndDate = FKWebTools.GetFKTimeString14(dtEnd);
                vResultJson.Add("end_time", sEndDate);
            }
               
            string sFinal = vResultJson.ToString(Formatting.None);
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_LOG_DATA", sFinal);
          
            GetLogBtn.Enabled = false;
            ClearBtn.Enabled = false;
            Timer.Enabled = true;
        }
        catch (Exception ex)
        {
            StatusTxt.Text = "Fail! Get Log Data! " + ex.ToString();
        }

    }
    


    protected void ClearBtn_Click(object sender, EventArgs e)
    {
        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "CLEAR_LOG_DATA", null);
            StatusTxt.Text = "Success : All of log data has been deleted!";
            GetLogBtn.Enabled = false;
            ClearBtn.Enabled = false;
            Timer.Enabled = true;
        }
        catch 
        {
            StatusTxt.Text = "Error: All of log data delete operation failed!";
        }
    }

    protected void Timer_Watch(object sender, EventArgs e)
    {
        int status;
        string sCommand = "";
        string sParam = "";
        string sCmdResult = "";

        if (m_db == null) m_db = new FKWebDB();
        if (m_db.GetCommand(mTransIdTxt.Text, out sCommand, out sParam, out status, out sCmdResult) == false) return;

        if (status > 0)
        {
            StatusTxt.Text = sCommand + " : Running!";
            //StatusTxt.Text = sCommand + " : Running!" + mDevId + ", " + m_db.GetFKDataLibName(mDevId);
            return;
        }

        StatusTxt.Text = sCommand + " : OK!";
        GetLogBtn.Enabled = true;
        ClearBtn.Enabled = true;
        Timer.Enabled = false;
        BindGridView();
        return;
       

    }
}