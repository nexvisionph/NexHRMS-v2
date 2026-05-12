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
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.IO;
using FKWeb;
using System.Data.SqlClient;
using System.Net;

public partial class DeviceManage : System.Web.UI.Page
{
    string mDevId;
    string mScreen;
    FKWebDB m_db;

    protected void Page_Load(object sender, EventArgs e)
    {
        mDevId = (string)Session["dev_id"];
        mScreen = (string)Session["screen"];

        if (mDevId == null) ShowMessage("DEVICE IS NOT SELECTED OR FOUND.");

        DevID.Text = mDevId;

        if (mScreen != null)
        {
            string[] tokens = mScreen.Split(' ');
            //ScreenInfo.Text = mScreen;
            if (tokens.Length > 1)
            {
                ScreenInfo.Text = String.Format("{0}x{1}", tokens[0], tokens[1]);
                Panel_Screen.Visible = true;
            }

        }
        else {
            Panel_Screen.Visible = false;
            ScreenInfo.Text = "";
        }
        Version.Text = ConfigurationManager.AppSettings["Version"];

        if (m_db == null) m_db = new FKWebDB();
    }
    protected void goback_Click(object sender, EventArgs e)
    {
        Response.Redirect("Default.aspx");
    }
    protected void SetTimeBtn_Click(object sender, EventArgs e)
    {
        try
        {
            DateTime now = DateTime.Now;
            string sNowTxt = FKWebTools.GetFKTimeString14(now);
            JObject vResultJson = new JObject();
            vResultJson.Add("time", sNowTxt);
            string sFinal = vResultJson.ToString(Formatting.None);
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_TIME", sFinal);
            Enables(false);
        }catch{
            StatusTxt.Text = "Error: Set time fail!";
        }
    }
    protected void ResetBtn_Click(object sender, EventArgs e)
    {
        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "RESET_FK", null);

            Enables(false);
        }
        catch
        {
            StatusTxt.Text = "Error: Reboot device fail!";
        }
    }
    protected void ClearBtn_Click(object sender, EventArgs e)
    {
        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "CLEAR_ENROLL_DATA", null);
            StatusTxt.Text = "Success : All of enroll data has been deleted!";
            Enables(false);
        }
        catch 
        {
            StatusTxt.Text = "Error: All of enroll data delete operation failed!";
        }
    }
    protected void ClearLogBtn_Click(object sender, EventArgs e)
    {
        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "CLEAR_LOG_DATA", null);
            StatusTxt.Text = "Success : All of log data has been deleted!";
            Enables(false);
        }
        catch
        {
            StatusTxt.Text = "Error: All of log data delete operation failed!";
        }
    }
    protected void SetDoorBtn_Click(object sender, EventArgs e)
    {
        try
        {
            string sDoorStatus = DoorStatus.SelectedItem.Text;
            if (sDoorStatus == "") return;

            JObject vResultJson = new JObject();
            vResultJson.Add("status", sDoorStatus);
            string sFinal = vResultJson.ToString(Formatting.None);
           
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_DOOR_STATUS", sFinal);
            StatusTxt.Text = "Success : Set Door As " + sDoorStatus + " !";
            Enables(false);
        }
        catch
        {
            StatusTxt.Text = "Error: All of log data delete operation failed!";
        }
    }
    protected void DevNameChangeBtn_Click(object sender, EventArgs e)
    {
        string mDevNameTxt = mDeviceName.Text;
        if(mDevNameTxt.Length == 0){
            StatusTxt.Text = ("Input the device name!");
            return;
        }
        try{
            JObject vResultJson = new JObject();
            vResultJson.Add("fk_name", mDevNameTxt);
            string sFinal = vResultJson.ToString(Formatting.None);
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_FK_NAME", sFinal);
            StatusTxt.Text = "Success : Device name has been changed!";
            Enables(false);
        }
        catch{
            StatusTxt.Text = "Error : Device name has not been changed!";
        }
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
    protected void ServerChangeBtn_Click(object sender, EventArgs e)
    {
        string mServerIpTxt = mServerIP.Text;
        string mPortTxt = mServerPort.Text;
        int mPort;
        if(mServerIpTxt.Length ==0){
            StatusTxt.Text = ("Input the server ip address!");
            return;
        }
        try
        {
            IPAddress ipAddr = IPAddress.Parse(mServerIpTxt);
        }
        catch{
            StatusTxt.Text = ("Invaild Ip address! Please Input the server ip address!");
            mServerIP.Text = "";
            return;
        }
        if (mPortTxt.Length == 0)
        {
            StatusTxt.Text = ("Input the server Port address!");
            return;
        }

        try
        {
             mPort = Convert.ToInt32(mPortTxt);
        }
        catch
        {
            StatusTxt.Text = ("Invaild port address! Please Input the server port address!");
            mServerPort.Text = "";
            return;
        }

        try
        {
            JObject vResultJson = new JObject();
            vResultJson.Add("ip_address", mServerIpTxt);
            vResultJson.Add("port", mPortTxt);
            string sFinal = vResultJson.ToString(Formatting.None);
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_WEB_SERVER_INFO", sFinal);
            StatusTxt.Text = "Success : Device's server info has been changed!,so that device is no longer in this server!";
            Enables(false);
        }
        catch
        {
            StatusTxt.Text = "Error : Device's server info has not been changed!";
        }
    }
    protected void UpdateBtn_Click(object sender, EventArgs e)
    {
        try
        {
            if (m_db == null) m_db = new FKWebDB();
            string default_filename = m_db.GetFirmwareFileName(mDevId);
            string FirmwareBinDir = Path.GetDirectoryName(ConfigurationManager.AppSettings["FirmwareBinDir"]);
            
            byte[] bytCmdParamFirmwareBin = new byte[0];
            byte[] bytCmdParam = new byte[0];
            if(default_filename.Length == 0){
                StatusTxt.Text = ("Couldn't get file name!");
                return;
            }
            Firmware.Text = default_filename;
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "UPDATE_FIRMWARE", null);
            StatusTxt.Text = mTransIdTxt.Text;
            Enables(false);
        }
        catch(Exception ex){
            StatusTxt.Text = ex.ToString();
        }

    }

    private void Enables(bool flag)
    {
        SetTimeBtn.Enabled = flag;
        ResetBtn.Enabled = flag;
        ClearBtn.Enabled = flag;
        ClearLogBtn.Enabled = flag;
        DevNameChangeBtn.Enabled = flag;
        ServerChangeBtn.Enabled = flag;
        UpdateBtn.Enabled = flag;
        Timer.Enabled = !flag;
        SetDoorBtn.Enabled = flag;
        DoorStatus.Enabled = flag;

        if (mScreen == "")
        {
            UpdateScreenBtn.Enabled = false;
            UpdateBackgroundBtn.Enabled = false;
            UpdateSplashBtn.Enabled = false;
        }
        else {
            UpdateScreenBtn.Enabled = flag;
            UpdateBackgroundBtn.Enabled = flag;
            UpdateSplashBtn.Enabled = flag;
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
            return;
        }

        StatusTxt.Text = sCommand + " : OK!";
        Enables(true);
    }
    protected void UpdateScreenBtn_Click(object sender, EventArgs e)
    {
        string mScreenTxt = Screen.Text;
        if (mScreenTxt.Length == 0)
        {
            StatusTxt.Text = ("Input the Screen Image Dir!");
            return;
        }
        try
        {
            string sPrefix = "screen";

            string sSearchPattern = sPrefix + "*.jpg";
            string[] sAryFilePaths = Directory.GetFiles(mScreenTxt, sSearchPattern,
                                         SearchOption.TopDirectoryOnly);

            int vnScreenId = 0;
            foreach (string sFileName in sAryFilePaths)
            {
                vnScreenId++;

                JObject vResultJson = new JObject();
                vResultJson.Add("firmware_file_type", String.Format("screen{0}", vnScreenId));
                vResultJson.Add("firmware_file_name", sFileName);
                string sFinal = vResultJson.ToString(Formatting.None);
                while (sFinal.Contains("\r\n "))
                {
                    sFinal.Replace("\r\n ", "\r\n");
                }
                sFinal.Replace("\r\n", "");
                mTransIdTxt.Text = m_db.SetCommand(mDevId, "UPDATE_FIRMWARE", sFinal);
            }
            StatusTxt.Text = mTransIdTxt.Text;
            Enables(false);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }

    }
    protected void UpdateBackgroundBtn_Click(object sender, EventArgs e)
    {
        string mScreenTxt = Background.Text;
        if (mScreenTxt.Length == 0)
        {
            StatusTxt.Text = ("Input the Background Image Path(*.jpg)!");
            return;
        }
        if (mScreenTxt.Contains(".jpg") == false)
        {
            StatusTxt.Text = ("Background Image format is JPG!");
            return;
        }
        try
        {

            JObject vResultJson = new JObject();
            vResultJson.Add("firmware_file_type", "background");
            vResultJson.Add("firmware_file_name", mScreenTxt);
            string sFinal = vResultJson.ToString(Formatting.None);
            while (sFinal.Contains("\r\n "))
            {
                sFinal.Replace("\r\n ", "\r\n");
            }
            sFinal.Replace("\r\n", "");
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "UPDATE_FIRMWARE", sFinal);
            StatusTxt.Text = mTransIdTxt.Text;
            Enables(false);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }

    }
    protected void UpdateSplashBtn_Click(object sender, EventArgs e)
    {
        string mScreenTxt = Splash.Text;
        if (mScreenTxt.Length == 0)
        {
            StatusTxt.Text = ("Input the Splash Image Path(*.bmp)!");
            return;
        }
        if (mScreenTxt.Contains(".bmp") == false)
        {
            StatusTxt.Text = ("Splash Image format is BMP!");
            return;
        }
        try
        {

            JObject vResultJson = new JObject();
            vResultJson.Add("firmware_file_type", "splash");
            vResultJson.Add("firmware_file_name", mScreenTxt);
            string sFinal = vResultJson.ToString(Formatting.None);
            while (sFinal.Contains("\r\n "))
            {
                sFinal.Replace("\r\n ", "\r\n");
            }
            sFinal.Replace("\r\n", "");
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "UPDATE_FIRMWARE", sFinal);
            StatusTxt.Text = mTransIdTxt.Text;
            Enables(false);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }

    }
}
