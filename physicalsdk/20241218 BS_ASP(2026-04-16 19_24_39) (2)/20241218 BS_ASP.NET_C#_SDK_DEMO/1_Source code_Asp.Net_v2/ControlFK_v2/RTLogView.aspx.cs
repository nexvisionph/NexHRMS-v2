using System;
using System.Collections;
using System.Configuration;
using System.Data;
using System.Web;
using System.Web.Security;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.UI.WebControls;
using System.Web.UI.WebControls.WebParts;
using System.Data.SqlClient;
using FKWeb;

public partial class RTLogView : System.Web.UI.Page
{
      FKWebDB m_db;
      string mDevId;
      int index;
      int   MAX_ROWS = 15;
      protected void Page_Load(object sender, EventArgs e)
    {
        mDevId = (string)Session["dev_id"];
        if (Session["timer"] == null) index = 0;
        else
            index = int.Parse(Session["timer"].ToString()); 
        index++;
        if (index >= MAX_ROWS) index = 0;
        if (index >= gvLog.Rows.Count) index = 0;
 
        Session["timer"] = index;
        gvLog.AllowSorting = true;
        Version.Text = ConfigurationManager.AppSettings["Version"];

        m_db = new FKWebDB();

        // Initialize the sorting expression. 
        //ViewState["SortExpression"] = "io_time ASC";
        ViewState["SortExpression"] = "io_time DESC";


        // Populate the GridView. 

        //index = 1;
    }

      private void DisplayLastLogImage(string logid)
      {
          string filename = "\\photo\\LogImage" + logid + ".jpg";
          string AbsImgUri = Server.MapPath(".") + filename;
          string relativeImgUrl = "." + filename;
          filename = "\\photo\\no_image.jpg";
          string AbsImgUri_no_image = Server.MapPath(".") + filename;
          string relativeImgUrl_no_image = "." + filename;
          if (FKWebTools.IsFile(AbsImgUri))
          {
              if (FKWebTools.FileSize(AbsImgUri) > 10) 
                  LogImage.ImageUrl = relativeImgUrl;
              else
                  LogImage.ImageUrl = relativeImgUrl_no_image;

              return;
          }


          if (m_db == null) m_db = new FKWebDB();
          //string sSql = "SELECT top 1 log_image FROM tbl_log_image where io_time >= '" + Session["run_time"] + "' order by io_time desc";
          string sSql = "SELECT top 1 t2.log_image FROM [AttDB2].[dbo].[tbl_log] as t1 left outer join [AttDB2].[dbo].[tbl_log_image] as t2";
          sSql += " on t1.io_time = t2.io_time and t1.user_id = t2.user_id and t1.dev_id = t2.dev_id";
          sSql += " where t1.io_time >= '" + Session["run_time"] + "'";
          sSql += " and t1.id >= " + logid + "";
          sSql += " order by t1.io_time desc";
          SqlCommand sqlCmd = m_db.SetSQL(sSql);
          sqlCmd.CommandType = CommandType.Text;

          sqlCmd.ExecuteNonQuery();

          SqlDataReader sqlDr = sqlCmd.ExecuteReader();
          byte[] abytEnroll = new byte[0];
          if (sqlDr.HasRows)
          {
              sqlDr.Read();
              System.Data.SqlTypes.SqlBytes bytes = sqlDr.GetSqlBytes(0);
              abytEnroll = bytes.Buffer;
          }

          sqlDr.Close();
          sqlCmd.Dispose();


          if (abytEnroll != null)
              FKWebTools.SaveToFile(AbsImgUri, abytEnroll);
          else {
              //FKWebTools.CopyFile(AbsImgUri_no_image, AbsImgUri);
              abytEnroll = new byte[]{1,0};
              FKWebTools.SaveToFile(AbsImgUri, abytEnroll);

         }
          //LogImage.ImageUrl = relativeImgUrl;

      }

    private void BindGridView()
    {
        // Get the connection string from Web.config.  
        // When we use Using statement,  
        // we don't need to explicitly dispose the object in the code,  
        // the using statement takes care of it. 
        try
        {
           // using (SqlConnection conn = new SqlConnection(ConfigurationManager.ConnectionStrings["SqlConnFkWeb"].ToString()))
            {
                // Create a DataSet object. 
                DataSet dsLog = new DataSet();

                // Create a SELECT query. 
                //string strSelectCmd = "SELECT * FROM tbl_log where io_time >= '" + Session["run_time"] + "'";
                //string strSelectCmd = "SELECT * FROM tbl_log where io_time >= '" + Session["run_time"] + "' and dev_id = '" + mDevId + "'";
                
                string strSelectCmd = "";
                //strSelectCmd += "SET LANGUAGE N'English'\n";
                strSelectCmd += "declare @Dtime1 datetime\n";
                strSelectCmd += "set @Dtime1 = '" + Session["run_time"] + "'\n";
                strSelectCmd += "declare @Dtime2 nvarchar(20)\n";
                strSelectCmd += "set @Dtime2 = CONVERT(varchar(100), @Dtime1, 23)\n";
                strSelectCmd += "SELECT top " + MAX_ROWS + " t1.*, t2.log_image FROM [AttDB2].[dbo].[tbl_log] as t1 left outer join [AttDB2].[dbo].[tbl_log_image] as t2";
                strSelectCmd += " on t1.io_time = t2.io_time and t1.user_id = t2.user_id and t1.dev_id = t2.dev_id";
                //strSelectCmd += " where t1.io_time >= '" + Session["run_time"] + "'";
                strSelectCmd += " where t1.io_time >= @Dtime2";
                strSelectCmd += " order by t1.io_time desc";
                
 
                if (m_db == null) m_db = new FKWebDB();
                SqlDataAdapter da = m_db.SetSQLDataAdapter(strSelectCmd);

                //da.Fill(dsLog, "tbl_log");
                // DataView dvLog = dsLog.Tables["tbl_log"].DefaultView;
                da.Fill(dsLog);
                DataView dvLog = dsLog.Tables[0].DefaultView;


                // Set the sort column and sort order. 
                dvLog.Sort = ViewState["SortExpression"].ToString();


                // Bind the GridView control. 
                gvLog.DataSource = dvLog;
                gvLog.DataBind();

                if (gvLog.Rows.Count > 0) 
                    gvLog.SelectedIndex = index;


                //StatusTxt.Text = strSelectCmd + DateTime.Now.ToString("HH:mm:ss tt");
                //StatusTxt.Text = "       Total Count : " + gvLog.Rows.Count + "&nbsp;&nbsp;&nbsp; Current Time :" + DateTime.Now.ToString("HH:mm:ss tt") + "  " + gvLog.SelectedIndex + "  " + index + " " + gvLog.SelectedRow.Cells[0].Text;
                StatusTxt.Text = "       Total Count : " + gvLog.Rows.Count + "&nbsp;&nbsp;&nbsp; Current Time :" + DateTime.Now.ToString("HH:mm:ss tt");
            }
        }catch(Exception ex){
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


    protected void gvLog_Sorting(object sender, GridViewSortEventArgs e)
    {
        string[] strSortExpression = ViewState["SortExpression"].ToString().Split(' ');


        // If the sorting column is the same as the previous one,  
        // then change the sort order. 
        if (strSortExpression[0] == e.SortExpression)
        {
            if (strSortExpression[1] == "ASC")
            {
                ViewState["SortExpression"] = e.SortExpression + " " + "DESC";
            }
            else
            {
                ViewState["SortExpression"] = e.SortExpression + " " + "ASC";
            }
        }
        // If sorting column is another column,   
        // then specify the sort order to "Ascending". 
        else
        {
            ViewState["SortExpression"] = e.SortExpression + " " + "ASC";
        }

        //Label1.Text = ViewState["SortExpression"].ToString();
        // Rebind the GridView control to show sorted data. 
        BindGridView();
    }


    protected void goback_Click(object sender, EventArgs e)
    {
        Response.Redirect("Default.aspx");
    }

    protected void Timer_Watch(object sender, EventArgs e)
    {
        //label is on first panel

   
        BindGridView();
        if (gvLog.SelectedRow != null)
            DisplayLastLogImage(gvLog.SelectedRow.Cells[0].Text);

    }

    protected void gvLog_SelectedIndexChanged(object sender, EventArgs e)
    {
        //int index = gvLog.SelectedIndex;
        //if (gvLog.SelectedIndex == null)             Session["timer"] = 0;

        //string ID = gvLog.SelectedDataKey.Values["id"].ToString();


        //StatusTxt.Text = "view" + ID;
        //StatusTxt.Text = "view : " + index;

    }
}
