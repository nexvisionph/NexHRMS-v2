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
public partial class RTEnrollView : System.Web.UI.Page
{
      FKWebDB m_db;
    protected void Page_Load(object sender, EventArgs e)
    {
         gvLog.AllowSorting = true;
         Version.Text = ConfigurationManager.AppSettings["Version"];

         m_db = new FKWebDB();

        ViewState["SortExpression"] = "regtime ASC";
   }

    private void BindGridView()
    {
        try
        {
            //using (SqlConnection conn = new SqlConnection(ConfigurationManager.ConnectionStrings["SqlConnFkWeb"].ToString()))
            {
                // Create a DataSet object. 
                DataSet dsLog = new DataSet();


                // Create a SELECT query. 
                string strSelectCmd = "SELECT * FROM tbl_user where regtime >= '"+Session["run_time"]+"'";


                // Create a SqlDataAdapter object 
                // SqlDataAdapter represents a set of data commands and a  
                // database connection that are used to fill the DataSet and  
                // update a SQL Server database.  
                if (m_db == null) m_db = new FKWebDB();
                SqlDataAdapter da = m_db.SetSQLDataAdapter(strSelectCmd);


                // Open the connection 
               // conn.Open();


                // Fill the DataTable named "Person" in DataSet with the rows 
                // returned by the query.new n 
                da.Fill(dsLog, "tbl_user");


                // Get the DataView from Person DataTable. 
                DataView dvLog = dsLog.Tables["tbl_user"].DefaultView;


                // Set the sort column and sort order. 
                dvLog.Sort = ViewState["SortExpression"].ToString();


                // Bind the GridView control. 
                gvLog.DataSource = dvLog;
                gvLog.DataBind();


                StatusTxt.Text = "       Total Count : " + gvLog.Rows.Count + "&nbsp;&nbsp;&nbsp; Current Time :" + DateTime.Now.ToString("HH:mm:ss tt") ;
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

    }
}
