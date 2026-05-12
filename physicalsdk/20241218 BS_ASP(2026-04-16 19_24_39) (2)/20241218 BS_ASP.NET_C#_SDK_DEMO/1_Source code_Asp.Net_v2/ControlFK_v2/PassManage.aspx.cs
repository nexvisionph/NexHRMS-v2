using System.Data.SqlClient;
using System.Net;
using System;
using System.Collections;
using System.Collections.Generic;
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


public partial class PassManage : System.Web.UI.Page
{
    string mDevId;
    FKWebDB m_db;
    string mMsg;

    protected void Page_Load(object sender, EventArgs e)
    {
        mDevId = (string)Session["dev_id"];

        if (mDevId == null) ShowMessage("DEVICE IS NOT SELECTED OR FOUND.");

        DevID.Text = mDevId;
        Version.Text = ConfigurationManager.AppSettings["Version"];

        if (m_db == null) m_db = new FKWebDB();
        mMsg = "";

        InitPassInfo();
    }
    protected void goback_Click(object sender, EventArgs e)
    {
        Response.Redirect("Default.aspx");
    }

    protected void InitPassInfo()
    {
        if (PassTimeNo.Text.Length == 0) PassTimeNo.Text = "1";
        if (GroupID.Text.Length == 0) GroupID.Text = "1";
        if (UserID.Text.Length == 0) UserID.Text = "1";
    }

    protected void ReadPassInfo()
    {
        int[,] vPassTime = new int[7, 4];
        int[] vPassGroup = new int[3];
        int[] vPassCombine = new int[10];
        int[] vUserPass = new int[4];
        string vUserId, vUserName, vUserPrivilege, vUserNote;
        vUserId = UserID.Text;

        string sDevStatus = m_db.GetDevStatus(mDevId);

        if (sDevStatus.Length == 0) return;

        JObject jobjDevStatus = JObject.Parse(sDevStatus);
        if (sDevStatus.Contains("pass_time") == true)
        {
            string sPassTime = jobjDevStatus["pass_time"].ToString();
            JArray jarrPassTime = (JArray)jobjDevStatus["pass_time"];
            string sItem = "";
            string sItemLast = "";
            int nPassTimeID = 0;
            if (PassTimeNo.Text.Length > 0) nPassTimeID = Convert.ToInt32(PassTimeNo.Text) - 1;

            for (int i = 0; i < jarrPassTime.Count; i++)
            {
                sItem = jarrPassTime[i].ToString();
                if (sItem.Length > 0) sItemLast = sItem;
                if (i != nPassTimeID) continue;
                mMsg = sItem;
                if (sItem.Length == 0) sItem = sItemLast;
                for (int j = 0; j < 7; j++)
                    for (int k = 0; k < 4; k++)
                    {
                        vPassTime[j, k] = Convert.ToInt32(sItem.Substring((j * 4 + k) * 2, 2));
                    }
            }

            PassTime00.Text = Convert.ToString(vPassTime[0, 0]);
            PassTime01.Text = Convert.ToString(vPassTime[0, 1]);
            PassTime02.Text = Convert.ToString(vPassTime[0, 2]);
            PassTime03.Text = Convert.ToString(vPassTime[0, 3]);
            PassTime10.Text = Convert.ToString(vPassTime[1, 0]);
            PassTime11.Text = Convert.ToString(vPassTime[1, 1]);
            PassTime12.Text = Convert.ToString(vPassTime[1, 2]);
            PassTime13.Text = Convert.ToString(vPassTime[1, 3]);
            PassTime20.Text = Convert.ToString(vPassTime[2, 0]);
            PassTime21.Text = Convert.ToString(vPassTime[2, 1]);
            PassTime22.Text = Convert.ToString(vPassTime[2, 2]);
            PassTime23.Text = Convert.ToString(vPassTime[2, 3]);
            PassTime30.Text = Convert.ToString(vPassTime[3, 0]);
            PassTime31.Text = Convert.ToString(vPassTime[3, 1]);
            PassTime32.Text = Convert.ToString(vPassTime[3, 2]);
            PassTime33.Text = Convert.ToString(vPassTime[3, 3]);
            PassTime40.Text = Convert.ToString(vPassTime[4, 0]);
            PassTime41.Text = Convert.ToString(vPassTime[4, 1]);
            PassTime42.Text = Convert.ToString(vPassTime[4, 2]);
            PassTime43.Text = Convert.ToString(vPassTime[4, 3]);
            PassTime50.Text = Convert.ToString(vPassTime[5, 0]);
            PassTime51.Text = Convert.ToString(vPassTime[5, 1]);
            PassTime52.Text = Convert.ToString(vPassTime[5, 2]);
            PassTime53.Text = Convert.ToString(vPassTime[5, 3]);
            PassTime60.Text = Convert.ToString(vPassTime[6, 0]);
            PassTime61.Text = Convert.ToString(vPassTime[6, 1]);
            PassTime62.Text = Convert.ToString(vPassTime[6, 2]);
            PassTime63.Text = Convert.ToString(vPassTime[6, 3]);
        }
        if (sDevStatus.Contains("pass_group") == true)
        {
            string sPassGroup = jobjDevStatus["pass_group"].ToString();
            JArray jarrPassGroup = (JArray)jobjDevStatus["pass_group"];
            string sItem = "";
            string sItemLast = "";
            int nPassGroupID = 0;
            if (GroupID.Text.Length > 0) nPassGroupID = Convert.ToInt32(GroupID.Text) - 1;

            for (int i = 0; i < jarrPassGroup.Count; i++)
            {
                sItem = jarrPassGroup[i].ToString();
                if (sItem.Length > 0) sItemLast = sItem;
                if (i != nPassGroupID) continue;
                mMsg = sItem;
                if (sItem.Length == 0) sItem = sItemLast;
                for (int j = 0; j < 3; j++)
                   vPassGroup[j] = Convert.ToInt32(sItem.Substring(j * 2, 2));
            }

            GroupPass0.Text = Convert.ToString(vPassGroup[0]);
            GroupPass1.Text = Convert.ToString(vPassGroup[1]);
            GroupPass2.Text = Convert.ToString(vPassGroup[2]);
        }
        if (sDevStatus.Contains("pass_combine") == true)
        {
            string sItem = jobjDevStatus["pass_combine"].ToString();
            for (int k = 0; k < 10; k++)
            {
                vPassCombine[k] = dec2mex(Convert.ToInt32(sItem.Substring(k * 2, 2)));
            }

            CombineGroup0.Text = Convert.ToString(vPassCombine[0]);
            CombineGroup1.Text = Convert.ToString(vPassCombine[1]);
            CombineGroup2.Text = Convert.ToString(vPassCombine[2]);
            CombineGroup3.Text = Convert.ToString(vPassCombine[3]);
            CombineGroup4.Text = Convert.ToString(vPassCombine[4]);
            CombineGroup5.Text = Convert.ToString(vPassCombine[5]);
            CombineGroup6.Text = Convert.ToString(vPassCombine[6]);
            CombineGroup7.Text = Convert.ToString(vPassCombine[7]);
            CombineGroup8.Text = Convert.ToString(vPassCombine[8]);
            CombineGroup9.Text = Convert.ToString(vPassCombine[9]);
        }
        if (sDevStatus.Contains("door_status") == true)
        {
            string sItem = jobjDevStatus["door_status"].ToString();
            DoorStatus.SelectedIndex = DoorStatus.Items.IndexOf(DoorStatus.Items.FindByValue(sItem));
        }

        /////////////////  user_pass  ///////////////////////////////////////////////////////////////////////////////////////
        if (vUserId.Length == 0) return;

        m_db.GetUser(mDevId, vUserId, out vUserName, out vUserPrivilege, out vUserNote);
        if (vUserNote.Length == 0) return;


        JObject jobjUserNote = JObject.Parse(vUserNote);
        if (vUserNote.Contains("user_pass") == true)
        {
            string sItem = jobjUserNote["user_pass"].ToString();
            for (int k = 0; k < 4; k++)
                vUserPass[k] = Convert.ToInt32(sItem.Substring(k * 2, 2));

            UserPassTime0.Text = Convert.ToString(vUserPass[0]);
            UserPassTime1.Text = Convert.ToString(vUserPass[1]);
            UserPassTime2.Text = Convert.ToString(vUserPass[2]);
            UserPassTime3.Text = Convert.ToString(vUserPass[3]);
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

        //ReadPassInfo();
        if (sCommand.Contains("SET_FK_NAME") == false
            && sCommand.Contains("SET_FK_NAME") == false)
        {
            ReadPassInfo();
        }
    }
    
    
    protected void ReadPassTimeBtn_Click(object sender, EventArgs e)
    {
        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_DEVICE_STATUS", null);
            StatusTxt.Text = "Success : Read PassTime OK!";
            Enables(false);
        }catch{
            StatusTxt.Text = "Error: Read PassTime failed!";
        }
    }
 
    protected void WritePassTimeBtn_Click(object sender, EventArgs e)
    {
        string sPassTimeID = PassTimeNo.Text;
        string sPassTime00 = PassTime00.Text;
        InitPassInfo();

        string sCmdParam = "{";
        sCmdParam += "\"pass_time\":{\"id\":" + sPassTimeID + ",";
        sCmdParam += "\"data\":\"";
        sCmdParam += toD2str(PassTime00.Text);
        sCmdParam += toD2str(PassTime01.Text);
        sCmdParam += toD2str(PassTime02.Text);
        sCmdParam += toD2str(PassTime03.Text);
        sCmdParam += toD2str(PassTime10.Text);
        sCmdParam += toD2str(PassTime11.Text);
        sCmdParam += toD2str(PassTime12.Text);
        sCmdParam += toD2str(PassTime13.Text);
        sCmdParam += toD2str(PassTime20.Text);
        sCmdParam += toD2str(PassTime21.Text);
        sCmdParam += toD2str(PassTime22.Text);
        sCmdParam += toD2str(PassTime23.Text);
        sCmdParam += toD2str(PassTime30.Text);
        sCmdParam += toD2str(PassTime31.Text);
        sCmdParam += toD2str(PassTime32.Text);
        sCmdParam += toD2str(PassTime33.Text);
        sCmdParam += toD2str(PassTime40.Text);
        sCmdParam += toD2str(PassTime41.Text);
        sCmdParam += toD2str(PassTime42.Text);
        sCmdParam += toD2str(PassTime43.Text);
        sCmdParam += toD2str(PassTime50.Text);
        sCmdParam += toD2str(PassTime51.Text);
        sCmdParam += toD2str(PassTime52.Text);
        sCmdParam += toD2str(PassTime53.Text);
        sCmdParam += toD2str(PassTime60.Text);
        sCmdParam += toD2str(PassTime61.Text);
        sCmdParam += toD2str(PassTime62.Text);
        sCmdParam += toD2str(PassTime63.Text); 
        sCmdParam += "\"}}";
       
        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_FK_NAME", sCmdParam);
            //StatusTxt.Text = "Success : Write Pass Time OK !";
            StatusTxt.Text = sCmdParam;
            //StatusTxt.Text = toD2str(PassTime0, 0]) + "   " + PassTime00.Text + "   " + sPassTime00;
            Enables(false);
        }
        catch
        {
            StatusTxt.Text = "Error: Write Pass Time failed!";
        }
    }

    protected void GetUserPassBtn_Click(object sender, EventArgs e)
    {
        string mStrParam;
        string sUserId = UserID.Text;
        try
        {
            JObject vResultJson = new JObject();
            vResultJson.Add("user_id", sUserId);
            mStrParam = vResultJson.ToString(Formatting.None);

            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_USER_INFO", mStrParam);
            StatusTxt.Text = "Success : Get UserPass OK!";
            Enables(false);
        }
        catch 
        {
            StatusTxt.Text = "Error: Get UserPass failed!";
        }
    }
    protected void SetUserPassBtn_Click(object sender, EventArgs e)
    {
        string sUserId = UserID.Text;
        string sUserPass = "";
        sUserPass += toD2str(UserPassTime0.Text);
        sUserPass += toD2str(UserPassTime1.Text);
        sUserPass += toD2str(UserPassTime2.Text);
        sUserPass += toD2str(UserPassTime3.Text);
        try
        {
            JObject vResultJson = new JObject();
            vResultJson.Add("user_id", sUserId);
            vResultJson.Add("user_pass", sUserPass);

            string sFinal = vResultJson.ToString(Formatting.None);
            while (sFinal.Contains("\r\n "))
            {
                sFinal.Replace("\r\n ", "\r\n");
            }
            sFinal.Replace("\r\n", "");

            if (m_db == null) m_db = new FKWebDB();
            m_db.SetUser(mDevId, sUserId, "Test", "USER", "{\"user_pass\":\"01020304\"}");
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_USER_NAME", sFinal);
            StatusTxt.Text = "Success : Set UserPass OK!";
            Enables(false);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = "Error: Set UserPass failed!" + ex.ToString();
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
    protected void GetDoorBtn_Click(object sender, EventArgs e)
    {
        try{
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_DEVICE_STATUS", null);
            StatusTxt.Text = "Success : Get Door Status OK!";
            Enables(false);
        }
        catch{
            StatusTxt.Text = "Error : Get Door Status failed!";
        }
    }
    protected void GetGroupPassBtn_Click(object sender, EventArgs e)
    {
        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_DEVICE_STATUS", null);
            StatusTxt.Text = "Success : Get GroupPass OK!";
            Enables(false);
        }
        catch
        {
            StatusTxt.Text = "Error: Get GroupPass failed!";
        }
    }
    protected void SetGroupPassBtn_Click(object sender, EventArgs e)
    {

        string sGroupID = GroupID.Text;

        string sCmdParam = "{";
        sCmdParam += "\"pass_group\":{\"id\":" + sGroupID + ",";
        sCmdParam += "\"data\":\"";
        sCmdParam += toD2str(GroupPass0.Text);
        sCmdParam += toD2str(GroupPass1.Text);
        sCmdParam += toD2str(GroupPass2.Text);
        sCmdParam += "\"}}";

        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_FK_NAME", sCmdParam);
            StatusTxt.Text = "Success : Set Group Pass OK !";
            Enables(false);
        }
        catch
        {
            StatusTxt.Text = "Error: Set Group Pass failed!";
        }
    }

    protected void GetCombineGroupBtn_Click(object sender, EventArgs e)
    {
        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_DEVICE_STATUS", null);
            StatusTxt.Text = "Success : Get CombineGroupe OK!";
            Enables(false);
        }
        catch
        {
            StatusTxt.Text = "Error: Get CombineGroup failed!";
        }
    }
    protected void SetCombineGroupBtn_Click(object sender, EventArgs e)
    {

        string sGroupID = GroupID.Text;

        string sCmdParam = "{";
        sCmdParam += "\"pass_combine\":\"";
        sCmdParam += toMexD2str(CombineGroup0.Text);
        sCmdParam += toMexD2str(CombineGroup1.Text);
        sCmdParam += toMexD2str(CombineGroup2.Text);
        sCmdParam += toMexD2str(CombineGroup3.Text);
        sCmdParam += toMexD2str(CombineGroup4.Text);
        sCmdParam += toMexD2str(CombineGroup5.Text);
        sCmdParam += toMexD2str(CombineGroup6.Text);
        sCmdParam += toMexD2str(CombineGroup7.Text);
        sCmdParam += toMexD2str(CombineGroup8.Text);
        sCmdParam += toMexD2str(CombineGroup9.Text);
        sCmdParam += "\"}";

        try
        {
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_FK_NAME", sCmdParam);
            StatusTxt.Text = "Success : Write Pass Time OK !";
            Enables(false);
        }
        catch
        {
            StatusTxt.Text = "Error: Write Pass Time failed!";
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

    private void Enables(bool flag)
    {
        ReadPassTimeBtn.Enabled = flag;
        WritePassTimeBtn.Enabled = flag;
        GetUserPassBtn.Enabled = flag;
        SetUserPassBtn.Enabled = flag;
        GetDoorBtn.Enabled = flag;
        GetGroupPassBtn.Enabled = flag;
        SetGroupPassBtn.Enabled = flag;
        GetCombineGroupBtn.Enabled = flag;
        SetCombineGroupBtn.Enabled = flag;
        Timer.Enabled = !flag;
        GetDoorBtn.Enabled = flag;
        SetDoorBtn.Enabled = flag;
        DoorStatus.Enabled = flag;
        PassTimeNo.Enabled = flag;
        GroupID.Enabled = flag;
        UserID.Enabled = flag;

        PassTime00.Enabled = flag;
        PassTime01.Enabled = flag;
        PassTime02.Enabled = flag;
        PassTime03.Enabled = flag;
        PassTime10.Enabled = flag;
        PassTime11.Enabled = flag;
        PassTime12.Enabled = flag;
        PassTime13.Enabled = flag;
        PassTime20.Enabled = flag;
        PassTime21.Enabled = flag;
        PassTime22.Enabled = flag;
        PassTime23.Enabled = flag;
        PassTime30.Enabled = flag;
        PassTime31.Enabled = flag;
        PassTime32.Enabled = flag;
        PassTime33.Enabled = flag;
        PassTime40.Enabled = flag;
        PassTime41.Enabled = flag;
        PassTime42.Enabled = flag;
        PassTime43.Enabled = flag;
        PassTime50.Enabled = flag;
        PassTime51.Enabled = flag;
        PassTime52.Enabled = flag;
        PassTime53.Enabled = flag;
        PassTime60.Enabled = flag;
        PassTime61.Enabled = flag;
        PassTime62.Enabled = flag;
        PassTime63.Enabled = flag;

        GroupPass0.Enabled = flag;
        GroupPass1.Enabled = flag;
        GroupPass2.Enabled = flag;

        CombineGroup0.Enabled = flag;
        CombineGroup1.Enabled = flag;
        CombineGroup2.Enabled = flag;
        CombineGroup3.Enabled = flag;
        CombineGroup4.Enabled = flag;
        CombineGroup5.Enabled = flag;
        CombineGroup6.Enabled = flag;
        CombineGroup7.Enabled = flag;
        CombineGroup8.Enabled = flag;
        CombineGroup9.Enabled = flag;

        UserPassTime0.Enabled = flag;
        UserPassTime1.Enabled = flag;
        UserPassTime2.Enabled = flag;
        UserPassTime3.Enabled = flag;



    }


    static public int dec2mex(int dec)
    {
        int D = 1;
        int mex = 0, t = 0;
        for (int i = 4; i >= 0; i--)
        {
            t = dec & (1 << i);
            if (t == 0) continue;
            mex += (i + 1) * D;
            D *= 10;
        }
        return mex;
    }

    static public int mex2dec(int mex)
    {
        int D = 10000;
        int dec = 0, t = mex, t1;
        for (int i = 0; i < 5; i++)
        {
            t1 = t / D;
            if (t1 > 0)
                dec |= (1 << (t1 - 1));
            t = t % D;
            D /= 10;
        }
        return dec;
    }

    static public string toD2str(string str)
    {
        string s = "00";
        if (str.Length == 0) return s;
        s = string.Format("{0:D2}", Convert.ToInt32(str));
        return s;
    }

    static public string toMexD2str(string str)
    {
        string s = "00";
        if (str.Length == 0) return s;
        s = string.Format("{0:D2}", mex2dec(Convert.ToInt32(str)));
        return s;
    }
}
