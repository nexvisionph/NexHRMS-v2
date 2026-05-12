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
public partial class RTOperView : System.Web.UI.Page
{
      FKWebDB m_db;
      string mDevId;
      protected void Page_Load(object sender, EventArgs e)
    {
        mDevId = (string)Session["dev_id"];
        gvOLog.AllowSorting = true;
        Version.Text = ConfigurationManager.AppSettings["Version"];

        m_db = new FKWebDB();

        // Initialize the sorting expression. 
        ViewState["SortExpression"] = "reg_time ASC";


        // Populate the GridView. 
      

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
                
                string strSelectCmd = "";
                //strSelectCmd += "SET LANGUAGE N'English'\n";
                strSelectCmd += "declare @Dtime1 datetime\n";
                strSelectCmd += "set @Dtime1 = '" + Session["run_time"] + "'\n";
                strSelectCmd += "declare @Dtime2 nvarchar(20)\n";
                strSelectCmd += "set @Dtime2 = CONVERT(varchar(100), @Dtime1, 23)\n";
                strSelectCmd += "SELECT top 15 * FROM [AttDB2].[dbo].[tbl_oper_log]";
                strSelectCmd += " where reg_time >= @Dtime2";
                strSelectCmd += " order by reg_time desc";
                
 
                if (m_db == null) m_db = new FKWebDB();
                SqlDataAdapter da = m_db.SetSQLDataAdapter(strSelectCmd);

                //da.Fill(dsLog, "tbl_log");
                // DataView dvLog = dsLog.Tables["tbl_log"].DefaultView;
                da.Fill(dsLog);
                DataView dvLog = dsLog.Tables[0].DefaultView;


                // Set the sort column and sort order. 
                dvLog.Sort = ViewState["SortExpression"].ToString();


                // Bind the GridView control. 
                gvOLog.DataSource = dvLog;
                gvOLog.DataBind();


                //StatusTxt.Text = strSelectCmd + DateTime.Now.ToString("HH:mm:ss tt");
                StatusTxt.Text = "       Total Count : " + gvOLog.Rows.Count + "&nbsp;&nbsp;&nbsp; Current Time :" + DateTime.Now.ToString("HH:mm:ss tt") ;
            }
        }catch(Exception ex){
            StatusTxt.Text = ex.ToString();
        }

    }

    protected void gvOLog_PageIndexChanging(object sender, GridViewPageEventArgs e)
    {
        // Set the index of the new display page.  
        gvOLog.PageIndex = e.NewPageIndex;


        // Rebind the GridView control to  
        // show data in the new page. 
        BindGridView();
    } 


    protected void gvOLog_Sorting(object sender, GridViewSortEventArgs e)
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

    }

}
