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
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using FKWeb;

public partial class FKAttend : System.Web.UI.Page
{
    FKWebDB m_db;
    private String mDeviceId;
    protected void Page_Load(object sender, EventArgs e)
    {
        mDeviceId = (string)Session["dev_id"];
        makeConfig();
        Session["run_time"] = DateTime.Now.ToString("yyyy-MM-dd hh:mm:ss");
        Session["timer"] = "0";
        //Session["screen"] = "";
        Version.Text = ConfigurationManager.AppSettings["Version"];

        if (Version.Text != "Ver 2.3.5")
        {
            RTOperBtn.Visible = false;
            //PassManBtn.Visible = false;
        }
        String custom = "";
        if (Session["custom"] != null) custom = Session["custom"].ToString();
        if (custom.Contains("realtime_operation") == true)
        {
            RTOperBtn.Visible = true;
        }
    }
    public void refresh_page()
    {
        Device_List.DataSource = DetectDevice();
        Device_List.DataTextField = "DeviceNameField";
        Device_List.DataValueField = "DeviceIDField";

        Device_List.DataBind();
        Device_List.SelectedIndex = 0;
        if (mDeviceId == null) return;
        if (mDeviceId.Length != 0)
        {
            Device_List.SelectedIndex = Device_List.Items.IndexOf(Device_List.Items.FindByValue(mDeviceId));
            select_device();
        }
    }
    public ICollection DetectDevice()
    {
        string sSql;

        if (m_db == null) m_db = new FKWebDB();
        //sSql = "select * from tbl_device";
        sSql = "select * from tbl_device order by regtime desc";
        SqlCommand sqlCmd = m_db.SetSQL(sSql);
        SqlDataReader sqlReader = sqlCmd.ExecuteReader();

        DataTable dt = new DataTable();
        int mCount = 0;
        dt.Columns.Add(new DataColumn("DeviceNameField", typeof(String)));
        dt.Columns.Add(new DataColumn("DeviceIDField", typeof(String)));

        dt.Rows.Add(CreateRow("none", null, dt));
     
       if (sqlReader.HasRows)
        {
            while (sqlReader.Read())
            {
                mCount++;
                dt.Rows.Add(CreateRow(sqlReader.GetString(2), sqlReader.GetString(1), dt));
            }
        }
        sqlReader.Close();
        StatusTxt.Text = "Device Count: "+mCount ;
        DataView dv = new DataView(dt);
        return dv;
    }
    DataRow CreateRow(String Text, String Value, DataTable dt)
    {
        DataRow dr = dt.NewRow();

        dr[0] = Text;
        dr[1] = Value;

        return dr;
    }
    protected void RefreshBtn_Click(object sender, EventArgs e)
    {
        refresh_page();
    }
    private void select_device()
    {
        string sSql;
        string sJson;
        string sBarcode;
        mDeviceId = (string)Session["dev_id"];//Device_List.SelectedItem.Value;
        LDev_Name.Text = Device_List.SelectedItem.Text + ":" + Device_List.SelectedItem.Value;// sqlReader.GetString(1);
        int mFlag = 0;

        if (m_db == null) m_db = new FKWebDB();
        sSql = "select * from tbl_device where dev_id='" + mDeviceId + "'";
        SqlCommand sqlCmd = m_db.SetSQL(sSql);
        SqlDataReader sqlReader = sqlCmd.ExecuteReader();
        DateTime dtNow, dtDev;
        dtNow = DateTime.Now;
        long nTimeDiff =0;
        try
        {
            if (sqlReader.HasRows)
            {
                if (sqlReader.Read())
                {
                    mFlag = 1;
                    LDev_ID.Text = mDeviceId;
                    LDev_Name.Text = sqlReader.GetString(2);
                    sJson = sqlReader.GetString(4);
                    JObject jobjTest = JObject.Parse(sJson);
                    LDev_Firmware.Text = jobjTest["firmware"].ToString();
                    LDev_Support.Text = jobjTest["supported_enroll_data"].ToString();//
                    if (jobjTest["door_status"] != null)
                        LDev_Door.Text = jobjTest["door_status"].ToString();//
                    if (jobjTest["screen"] != null)
                        Session["screen"] = jobjTest["screen"].ToString();
                    else
                        Session["screen"] = "";
                    if (jobjTest["custom"] != null)
                        Session["custom"] = jobjTest["custom"].ToString();
                    else
                        Session["custom"] = "";
                    dtDev = sqlReader.GetDateTime(3);
                    nTimeDiff = dtNow.Ticks - dtDev.Ticks;
                    UpdateTimeTxt.Text = Convert.ToString(dtDev);// +":" + Convert.ToString(dtNow) + "---->" + Convert.ToString(nTimeDiff);//
                }
            }
            else {
                //Session["screen"] = "";
            }
            if (mFlag == 0)
            {
                LDev_ID.Text = mDeviceId;
                LDev_Name.Text = Device_List.SelectedItem.Text;
                LDev_Firmware.Text = "";
                LDev_Support.Text = "";//
            }
            sqlReader.Close();
            m_db.displayDeviceLive(mDeviceId, ref StatusImg, UpdateTimeTxt);
            m_db.GetBarcode(mDeviceId, out sBarcode);
            LDev_Barcode.Text = sBarcode;//
           
        }
        catch
        {
            //StatusTxt.Text = ex.ToString();
            sqlReader.Close();
        }
    }
    protected void Device_List_SelectedIndexChanged(object sender, EventArgs e)
    {
        StatusTxt.Text = Device_List.SelectedItem.Value;
        Session["dev_id"] = Device_List.SelectedItem.Value;
        select_device();
    }
    protected void RTLogBtn_Click(object sender, EventArgs e)
    {
        Response.Redirect("RTLogView.aspx");
    }
    protected void UserManBtn_Click(object sender, EventArgs e)
    {
        if (Device_List.SelectedItem == null)
        {
            StatusTxt.Text = ("You must select device!");
            return;
        }
        if (mDeviceId == null || mDeviceId == "" || mDeviceId.Length == 0 )
        {
            StatusTxt.Text = ("You must select avaiable device!");
            return;
        }

        if (m_db == null) m_db = new FKWebDB();
        if (m_db.displayDeviceLive(mDeviceId, ref StatusImg, UpdateTimeTxt) == 0)
        {
            StatusTxt.Text = "Error: Device has been disconnected!";
            return;
        }

        emptyUserListTable();
        Session["operation"] = 0;
        Response.Redirect("UserManage.aspx");
    }
    public void emptyUserListTable()
    {
        if (m_db == null) m_db = new FKWebDB();
        Session["trans_id"] = m_db.SetCommand(mDeviceId, "GET_USER_ID_LIST", null);
    }
    public void ShowMessage(String msgStr)
    {
        System.Text.StringBuilder sb = new System.Text.StringBuilder();

        sb.Append("<script type = 'text/javascript'>");
        sb.Append("window.onload=function(){");
        sb.Append("alert('");
        sb.Append(msgStr);
        sb.Append("')};");
        sb.Append("</script>");

        ClientScript.RegisterClientScriptBlock(this.GetType(), "alert", sb.ToString());
    }
    protected void LogManBtn_Click(object sender, EventArgs e)
    {
        if (Device_List.SelectedItem == null)
        {
            StatusTxt.Text = ("You must select device!");
            return;
        }
        mDeviceId = Device_List.SelectedItem.Value;
        StatusTxt.Text = "ID=" + mDeviceId;
        if (mDeviceId == null || mDeviceId == "" || mDeviceId.Length == 0)
        {
            StatusTxt.Text = ("You must select avaiable device!");
            return;
        }
        if (m_db == null) m_db = new FKWebDB();
        if (m_db.displayDeviceLive(mDeviceId, ref StatusImg, UpdateTimeTxt) == 0)
        {
            StatusTxt.Text = "Error: Device has been disconnected!";
            return;
        }

        emptyUserListTable();
        Response.Redirect("LogManager.aspx");
    }
    protected void DevManBtn_Click(object sender, EventArgs e)
    {
        if (mDeviceId == null || mDeviceId == "" || mDeviceId.Length == 0)
        {
            StatusTxt.Text = ("You must select avaiable device!");
            return;
        }
        if (m_db == null) m_db = new FKWebDB();
        if (m_db.displayDeviceLive(mDeviceId, ref StatusImg, UpdateTimeTxt) == 0)
        {
            StatusTxt.Text = "Error: Device has been disconnected!";
            return;
        }
        Response.Redirect("DeviceManage.aspx");
    }
    private void Enables(Boolean flag)
    {
    }
    protected void Timer_Watch(object sender, EventArgs e)
    {
        Timer.Interval = 3000;
        refresh_page();
        StatusTxt.Text = "Current Time  " + Convert.ToString(DateTime.Now);
    }
    protected void RTEnrollBtn_Click(object sender, EventArgs e)
    {
        Response.Redirect("RTEnrollView.aspx");
    }
    private void makeConfig()
    {
        string defaultdir = Path.GetDirectoryName(ConfigurationManager.AppSettings["DefaultDir"]);
        string logimagedir = Path.GetDirectoryName(ConfigurationManager.AppSettings["LogImgRootDir"]);
        string FirmwareBinDir = Path.GetDirectoryName(ConfigurationManager.AppSettings["FirmwareBinDir"]);
        string photodir = Server.MapPath(".") + "\\photo\\";
        if (!Directory.Exists(defaultdir))
            Directory.CreateDirectory(defaultdir);
        if (!Directory.Exists(logimagedir))
            Directory.CreateDirectory(logimagedir);
        if (!Directory.Exists(FirmwareBinDir))
            Directory.CreateDirectory(FirmwareBinDir);
        if (!Directory.Exists(photodir))
            Directory.CreateDirectory(photodir);
    }
    protected void PassManBtn_Click(object sender, EventArgs e)
    {
        if (mDeviceId == null || mDeviceId == "" || mDeviceId.Length == 0)
        {
            StatusTxt.Text = ("You must select avaiable device!");
            return;
        }
        if (m_db == null) m_db = new FKWebDB();
        if (m_db.displayDeviceLive(mDeviceId, ref StatusImg, UpdateTimeTxt) == 0)
        {
            StatusTxt.Text = "Error: Device has been disconnected!";
            return;
        }
        Response.Redirect("PassManage.aspx");
    }
    protected void RTOperBtn_Click(object sender, EventArgs e)
    {
        Response.Redirect("RTOperView.aspx");
    }
    protected void OneTimePassBtn_Click(object sender, EventArgs e)
    {
        Response.Redirect("OneTimePass.aspx");
    }

}
