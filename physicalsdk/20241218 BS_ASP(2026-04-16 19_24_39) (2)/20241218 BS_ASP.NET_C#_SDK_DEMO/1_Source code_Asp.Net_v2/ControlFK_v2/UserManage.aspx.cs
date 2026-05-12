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
using System.Data.SqlClient;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.IO;
using FKWeb;

public partial class UserManage : System.Web.UI.Page
{
    FKWebDB m_db;
    string mDevId;
    string mUserId;
    string mUserName;
    string mUserPrivilege;
    List<EnrollData> mlistEnrollData;
    bool mHasPhoto;

    const int GET_USER_ID_LIST = 0;
    const int GET_USER_INFO = 1;
    const int SET_USER_INFO = 2;
    const int DEL_USER_INFO = 3;
    const int ALL_DEL = 4;
    const int GET_ALL_USER_INFO = 5;
    const int SET_ALL_USER_INFO = 6;
    const int SET_USER_NAME = 7;
    const int SET_USER_PRIVILEGE = 8;
    const int COPY_ALL_USER_INFO = 9;
    const int INIT_DB = 10;


    const int STATE_WAIT = 0;
    const int STATE_VIEW = 1;
    const int STATE_EDIT = 2;

    const int LIST_OF_DEVICE = 0;
    const int LIST_OF_PC = 1;
    const int LIST_OF_DEVICE_FOR_BATCH = 2;

    protected void Page_Load(object sender, EventArgs e)
    {
        if (m_db == null) m_db = new FKWebDB();

        mDevId = (string)Session["dev_id"];
        if (Session["cur_state"] == null) Session["cur_state"] = STATE_VIEW;

        //DevID.Text = string.Format("{0} state:{1} trans:{2}, operation:{3}", mDevId, Session["cur_state"], Session["trans_id"], Session["operation"]);
        DevID.Text = string.Format("{0}", mDevId);
        Version.Text = ConfigurationManager.AppSettings["Version"];
    }

    protected void Timer_Watch(object sender, EventArgs e)
    {
        string sCommand = "";
        string sParam = "";
        int status = 0;

        if (m_db == null) m_db = new FKWebDB();
        status = m_db.IsDeviceRunning(mDevId, out sCommand, out sParam);

        if (status > 0)
        {
            sleepState();
            StatusTxt.Text = sCommand + " : Running!";
            return;
        }

        if (sCommand.Contains("USER_INFO") == true)
        {
            JObject vParamJson = JObject.Parse(sParam);
            string sUserId = vParamJson["user_id"].ToString();

            if (sUserId != mUserId) { 
                DisplayUserInfo(sUserId);
                mUserId = sUserId;
            }
        }

        if (sCommand.Contains("USER_ID_LIST") == true)
        {
            DisplayUserList();

            if ((int)Session["operation"] == GET_ALL_USER_INFO) 
            { 
                string sUserId;
                for (int index = 0; index < UserList.Items.Count; index++)
                {
                    sUserId = UserList.Items[index].Text;
                    GetUserInfo(sUserId);
                }
                if (UserList.Items.Count > 0) return;//if userlist have one more items, then continue to sleep 
            }
        }

        wakeupState();

        DisplayDataSourceDevice();

        StatusTxt.Text = sCommand + " : OK!"; 
    }

    protected void ConnectStatusTimer_Watch(object sender, EventArgs e)
    {
        if (m_db == null) m_db = new FKWebDB();
        m_db.displayDeviceLive(mDevId, ref StatusImg, UpdateTimeTxt);
    }

    private void setState(int state)
    {
        bool disable = false;
        bool editable = false;
        bool hasUserId = false;

        if (UserID.Text.Length > 0) hasUserId = true;
        if (UserList.DataSource != null && UserList.SelectedIndex >= 0) hasUserId = true;

        ReadUser_IndexLbl.Text = (UserList.SelectedIndex + 1) + "/" + UserList.Items.Count;

        if (state > 0)
        {
            Session["cur_state"] = state;
        }

        if (state == STATE_WAIT) { StatusTxt.Text = "WAIT ..."; disable = true; editable = false; Timer.Interval = 1000; }//waiting
        if (state == STATE_VIEW) { disable = false; editable = false; Timer.Interval = 60000; }//viewing
        if (state == STATE_EDIT) { disable = false; editable = true; }//editing

        if (mDevId == null) disable = true;

        Timer.Enabled = disable;

        UserList.Enabled = !disable;
        UpdateUserListBtn.Enabled = !disable;

        NewBtn.Enabled = !disable && editable;
        ModifyBtn.Enabled = !disable;
        ModifyBtn.Text = "Editable";
        if (state == STATE_EDIT) ModifyBtn.Text = "Uneditable";
        PhotoPath.Enabled = !disable && editable && hasUserId;
        SetNameBtn.Enabled = !disable && editable && hasUserId;
        SetPriviligeBtn.Enabled = !disable && editable && hasUserId;
        SetCardBtn.Enabled = !disable && editable && hasUserId;
        SetPasswordBtn.Enabled = !disable && editable && hasUserId;

        ReadUser_FirstBtn.Enabled = !disable;
        ReadUser_LastBtn.Enabled = !disable;
        ReadUser_PrevBtn.Enabled = !disable;
        ReadUser_NextBtn.Enabled = !disable;

        GetInfoBtn.Enabled = !disable;
        SetInfoBtn.Enabled = !disable;
        DeleteUserBtn.Enabled = !disable;
        ClearBtn.Enabled = !disable;
        InitDBBtn.Enabled = !disable;
        GetAllUserBtn.Enabled = !disable;
        SetAllUserBtn.Enabled = !disable;
        CopyAllUserBtn.Enabled = !disable;
        SetPhotoBtn.Enabled = !disable;
        Device_List.Enabled = !disable;
        PhotoPath.Enabled = !disable;

        UserName.Enabled = !disable && editable;
        UserPriv.Enabled = !disable && editable;
        UserID.Enabled = !disable && editable;
        CardNum.Enabled = !disable && editable;
        Password.Enabled = !disable && editable;

        UserPhoto.ImageUrl = ".\\photo\\" + mDevId + "_" + UserID.Text + ".jpg";
    }
    protected void sleepState()
    {
        setState(STATE_WAIT);
    }
    protected void wakeupState()
    {
        setState((int)Session["cur_state"]);
    }
    protected void changeState()
    {
        int state = (int)Session["cur_state"];

        if (state == STATE_VIEW)
        {
            setState(STATE_EDIT);
            return;
        }
        if (state == STATE_EDIT) setState(STATE_VIEW);
    }

    DataRow CreateRow(String Text, String Value, DataTable dt)
    {
        DataRow dr = dt.NewRow();
        dr[0] = Text;
        dr[1] = Value;
        return dr;
    }

    private int GetNewUserID()
    {
        string sSql;
        SqlCommand sqlCmd;
        SqlDataReader sqlReader;
        int i = 0; 
        sSql = "select max(user_id) from tbl_user where dev_id = '" + mDevId + "'";
        if (m_db == null) m_db = new FKWebDB();
        sqlCmd = m_db.SetSQL(sSql);
        sqlReader = sqlCmd.ExecuteReader();
        if (sqlReader.Read ())
        {
            string tmp = FKWebTools.GetStringFromObject(sqlReader[0]);
            if (tmp.Length > 0) 
                i = Convert.ToInt32(tmp);
        }
        sqlReader.Close();
        i++;
        return i;
    }


    public void refresh_page()
    {
        sleepState();
        DisplayUserList();
    }

    public void DisplayUserList()
    {
        //DevID.Text = string.Format("{0} list_mode:{1} trans:{2} batch:{3}", mDevId, mod, mTransIdTxt.Text, mBatchTransIdTxt.Text);
        UserList.DataSource = GetUserList(mDevId);
        if (UserList.DataSource == null) return;

        UserList.DataTextField = "UserName";
        UserList.DataValueField = "UserID";
        UserList.DataBind();
        UserList.SelectedIndex = 0;

        if (Session["next_user_id"] != null && (int)Session["next_user_id"] > 0) 
            UserList.SelectedIndex = (int)Session["next_user_id"];
    }

    public ICollection GetUserList(string dev_id) //0: of Device, 1: of PC, 2: for Batch of Device
    {
        string sSql;
        sSql = "select DISTINCT user_id from tbl_user where dev_id='" + dev_id + "'";

        if (m_db == null) m_db = new FKWebDB();
        SqlCommand sqlCmd = m_db.SetSQL(sSql);
        SqlDataReader sqlReader = sqlCmd.ExecuteReader();

        DataTable dt = new DataTable();
        int mCount = 0;
        dt.Columns.Add(new DataColumn("UserName", typeof(String)));
        dt.Columns.Add(new DataColumn("UserID", typeof(String)));

        if (sqlReader.HasRows)
        {
           while (sqlReader.Read())
            {
                mCount++;
                dt.Rows.Add(CreateRow(sqlReader.GetString(0),sqlReader.GetString(0), dt));
            }
        }
        sqlReader.Close();

        if (mCount == 0) return null;

        DataView dv = new DataView(dt);
        return dv;

    }

    private void ReadLastUserInfo()
    {
        StatusTxt.Text = "ReadLastUserInfo";

        string sSql = "select top 1 user_id from tbl_user where dev_id='" + mDevId + "' ORDER BY regtime DESC";
        SqlCommand sqlCmd = m_db.SetSQL(sSql);
        SqlDataReader sqlReader = sqlCmd.ExecuteReader();

        string sUserId = "";
        if (sqlReader.HasRows)
        {
            if (sqlReader.Read())
            {
                sUserId = sqlReader.GetString(0);
            }
        }
        sqlReader.Close();

        DisplayUserInfo(sUserId);

        StatusTxt.Text = "ReadLastUserInfo OK";
    }

    private void DisplayUserInfo(string asUserId)
    {
        if (asUserId.Length == 0) return;

        UserList.SelectedIndex = UserList.Items.IndexOf(UserList.Items.FindByText(asUserId));

        mUserName = "";
        mUserPrivilege = "";
        mlistEnrollData = new List<EnrollData>();
        mHasPhoto = false;
        string vUserNote = "";

        if (m_db == null) m_db = new FKWebDB();
        if (asUserId.Length > 0)
        {
            m_db.GetUser(mDevId, asUserId, out mUserName, out mUserPrivilege, out vUserNote);
            m_db.GetEnrollDataList(mDevId, asUserId, out mlistEnrollData, out mHasPhoto);
        }

        UserID.Text = asUserId;
        UserName.Text = mUserName;
        UserPriv.SelectedIndex = UserPriv.Items.IndexOf(UserPriv.Items.FindByText(mUserPrivilege));

        string AbsImgUri = Server.MapPath(".") + "\\photo\\" + mDevId + "_" + asUserId + ".jpg";
        string relativeImgUrl = ".\\photo\\" + mDevId + "_" + asUserId + ".jpg";

        string fn_debug = Server.MapPath(".") + "\\photo\\disp_" + mDevId + "_" + asUserId + ".dat";//+ sCmdCode

        if (mHasPhoto == false) FKWebTools.DeleteFile(AbsImgUri);

        //init UserInfo
        Password.Text = "";
        CardNum.Text = "";
        Fp.Checked = false;
        Face.Checked = false; ;
        Palm.Checked = false;

        foreach (EnrollData ed in mlistEnrollData)
        {
            if (ed.BackupNumber == FKWebDB.BACKUP_USER_PHOTO)
            {
                FKWebTools.SaveToFile(AbsImgUri, ed.bytData);
                UserPhoto.ImageUrl = relativeImgUrl;

                FKWebTools.SaveToFile(fn_debug, ed.bytData);
            }
            if (ed.BackupNumber == FKWebDB.BACKUP_PSW)
            {
                Password.Text = System.Text.Encoding.Default.GetString(ed.bytData);
            }
            if (ed.BackupNumber == FKWebDB.BACKUP_CARD)
            {
                CardNum.Text = System.Text.Encoding.Default.GetString(ed.bytData);
            }
            if (ed.BackupNumber >= FKWebDB.BACKUP_FP_0 && ed.BackupNumber <= FKWebDB.BACKUP_FP_9)
            {
                Fp.Checked = true;
            }
            if (ed.BackupNumber == FKWebDB.BACKUP_FACE || ed.BackupNumber == FKWebDB.BACKUP_VFACE)
            {
                Face.Checked = true; ;
            }
            if (ed.BackupNumber >= FKWebDB.BACKUP_PALMVEIN_0 && ed.BackupNumber <= FKWebDB.BACKUP_PALMVEIN_3)
            {
                Palm.Checked = true;
            }

        }

        //DevID.Text = string.Format("{0} state:{1} trans:{2}, operation:{3}, DATA:{4}", mDevId, Session["cur_state"], Session["trans_id"], Session["operation"], data);
    }

    public void emptyUserListTable()
    {
        if (m_db == null) m_db = new FKWebDB();
        mBatchTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_USER_ID_LIST", null);
    }


    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////// EVENT HANDLER //////////////////////////////////////////////////////////////

    protected void goback_Click(object sender, EventArgs e)
    {
        Response.Redirect("Default.aspx");
    }

    protected void RefreshBtn_Click(object sender, EventArgs e)
    {
        DisplayUserList();
    }

    protected void UpdateUserListBtn_Click(object sender, EventArgs e)
    {
        sleepState();
        Session["operation"] = GET_USER_ID_LIST;
        Session["next_user_id"] = UserList.SelectedIndex;
        if (m_db == null) m_db = new FKWebDB();
        mTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_USER_ID_LIST", null);
    }

    protected void NewBtn_Click(object sender, EventArgs e)
    {
        UserID.Text = Convert.ToString(GetNewUserID());
    }

    protected void ModifyBtn_Click(object sender, EventArgs e)
    {
        //string asUserId = UserID.Text;
        
        //if (m_db == null) m_db = new FKWebDB();
        //if (asUserId.Length > 0)
        //{
        //    m_db.GetUser(mDevId, asUserId, out mUserName, out mUserPrivilege);
        //    m_db.GetEnrollDataList(mDevId, asUserId, out mlistEnrollData, out mHasPhoto);
        //}

        //if (Password.Text.Length > 0) { 
        //    byte[] abytEnrollData = System.Text.Encoding.Default.GetBytes(Password.Text);
        //    m_db.SetEnrollData(mDevId, asUserId, FKWebDB.BACKUP_PSW, abytEnrollData);
        //}

        changeState();
    }

    protected void DeleteUserBtn_Click(object sender, EventArgs e)
    {
        sleepState();
        try
        {
            Session["operation"] = DEL_USER_INFO;
            string sUserId = UserList.SelectedItem.Text;
            JObject vResultJson = new JObject();
            vResultJson.Add("user_id", sUserId);
            string sFinal = vResultJson.ToString(Formatting.None);
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "DELETE_USER", sFinal);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }
    }

    protected void ClearBtn_Click(object sender, EventArgs e)
    {
        sleepState();
        try
        {
            Session["operation"] = ALL_DEL;
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "CLEAR_ENROLL_DATA", null);

        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }
    }

    protected void InitDBBtn_Click(object sender, EventArgs e)
    {
        sleepState();
        try
        {
            Session["operation"] = INIT_DB;
            if (m_db == null) m_db = new FKWebDB();
            m_db.ClearUser(mDevId);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }
        wakeupState();
    }

    protected void GetAllUserBtn_Click(object sender, EventArgs e)
    {
        sleepState();
        Session["operation"] = GET_ALL_USER_INFO;

        if (m_db == null) m_db = new FKWebDB();
        m_db.ClearUser(mDevId);
        mTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_USER_ID_LIST", null);
    }

    protected void GetInfoBtn_Click(object sender, EventArgs e)
    {
        mUserId = UserList.SelectedItem.Text;
        if (mUserId == "")
        {
            StatusTxt.Text = "UserID is Empty, please input or select UserID.";
            return;
        }
        sleepState();

        Session["operation"] = GET_USER_INFO;
        GetUserInfo(mUserId);
    }

    protected void GetUserInfo(string sUserId)
    {
        if (sUserId == null) return;
        if (sUserId == "") return;


        byte[] mByteParam = new byte[0];
        string mStrParam;
        try
        {
            JObject vResultJson = new JObject();
            vResultJson.Add("user_id", sUserId);
            mStrParam = vResultJson.ToString(Formatting.None);

            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "GET_USER_INFO", mStrParam);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }
    }

    protected void SetAllUserBtn_Click(object sender, EventArgs e)
    {
        try
        {
            DisplayUserList();
            if (UserList.DataSource == null) return;

            sleepState();
            Session["operation"] = SET_ALL_USER_INFO;

            string sUserId;
            for (int index = 0; index < UserList.Items.Count; index++)
            {
                sUserId = UserList.Items[index].Text;
                SetUserInfo(sUserId);
            }
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }
    }
    protected void Copy_All_Uset_From_SelectedDevice(object sender, EventArgs e)
    {

        Session["operation"] = COPY_ALL_USER_INFO;
        StatusTxt.Text = Device_List.SelectedItem.Value;
        string dev_id = Device_List.SelectedItem.Value;
        string sSql = "select DISTINCT user_id from tbl_user where dev_id='" + dev_id + "'";

        if (m_db == null) m_db = new FKWebDB();
        SqlCommand sqlCmd = m_db.SetSQL(sSql);
        SqlDataReader sqlReader = sqlCmd.ExecuteReader();

        List<string> user_id_list = new List<string>();
        if (sqlReader.HasRows)
        {
            while (sqlReader.Read())
            {
                user_id_list.Add(sqlReader.GetString(0));
            }
        }
        sqlReader.Close();

        foreach (string user_id in user_id_list) 
        {
            CopyUserInfo(user_id, dev_id);
        }
    }
    public void DisplayDataSourceDevice()
    {
        Device_List.DataSource = FindDataSourceDevice();
        Device_List.DataTextField = "DeviceNameField";
        Device_List.DataValueField = "DeviceIDField";

        Device_List.DataBind();
        Device_List.SelectedIndex = 0;
    }
    public ICollection FindDataSourceDevice()
    {
        string sSql;

        if (m_db == null) m_db = new FKWebDB();
        sSql = "select distinct dev_id from tbl_user";
        SqlCommand sqlCmd = m_db.SetSQL(sSql);
        SqlDataReader sqlReader = sqlCmd.ExecuteReader();

        DataTable dt = new DataTable();
        int mCount = 0;
        dt.Columns.Add(new DataColumn("DeviceNameField", typeof(String)));
        dt.Columns.Add(new DataColumn("DeviceIDField", typeof(String)));

        dt.Rows.Add(CreateRow("none", null, dt));

        string dev_id = "";
        if (sqlReader.HasRows)
        {
            while (sqlReader.Read())
            {
                if (mDevId == sqlReader.GetString(0)) continue;
                dev_id += " " + sqlReader.GetString(0);
            }
        }
        sqlReader.Close();
        string[] dev_ids = dev_id.Split(' ');
        for (int i = 0; i < dev_ids.Length; i++)
        {
            if (dev_ids[i] == "") continue;
            dt.Rows.Add(CreateRow(m_db.GetDevName(dev_ids[i]), dev_ids[i], dt));
        }

        StatusTxt.Text = "Device Count: " + mCount;
        DataView dv = new DataView(dt);
        return dv;
    }

    protected void SetInfoBtn_Click(object sender, EventArgs e)
    {
        mUserId = UserID.Text;
        if (UserID.Text.Length > 0)
        {
            mUserId = UserID.Text;
        }
        else
            mUserId = UserList.SelectedItem.Text;
        if (mUserId == "")
        {
            StatusTxt.Text = "UserID is Empty, please input or select UserID.";
            return;
        }

        int state = (int)Session["cur_state"];
        if (state == STATE_EDIT)
        {
            if (Password.Text.Length > 0)
            {
                byte[] abytEnrollData = System.Text.Encoding.Default.GetBytes(Password.Text);
                m_db.SetEnrollData(mDevId, mUserId, FKWebDB.BACKUP_PSW, abytEnrollData);
            }

            if (CardNum.Text.Length > 0)
            {
                byte[] abytEnrollData = System.Text.Encoding.Default.GetBytes(CardNum.Text);
                m_db.SetEnrollData(mDevId, mUserId, FKWebDB.BACKUP_CARD, abytEnrollData);
            }
        }


        Session["operation"] = SET_USER_INFO;
        SetUserInfo(mUserId);
    }

    protected void SetUserInfo(string sUserId)
    {
        if (sUserId == null) return;
        if (sUserId == "") return;

        string sMsg = "SetUserInfo ";

        sleepState();
        try
        {
            JObject vResultJson = new JObject();
            vResultJson.Add("user_id", sUserId);
            string sFinal = vResultJson.ToString(Formatting.None);
            while (sFinal.Contains("\r\n "))
            {
                sFinal.Replace("\r\n ", "\r\n");
            }
            sFinal.Replace("\r\n", "");
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_USER_INFO", sFinal);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = sMsg + ex.ToString();
        }
    }

    protected void CopyUserInfo(string sUserId, string sDevId)
    {
        if (sUserId == null) return;
        if (sUserId == "") return;
        if (sDevId == null) return;
        if (sDevId == "") return;

        string sMsg = "CopyUserInfo ";

        sleepState();
        try
        {
            JObject vResultJson = new JObject();
            vResultJson.Add("user_id", sUserId);
            vResultJson.Add("dev_id", sDevId);
            string sFinal = vResultJson.ToString(Formatting.None);
            while (sFinal.Contains("\r\n "))
            {
                sFinal.Replace("\r\n ", "\r\n");
            }
            sFinal.Replace("\r\n", "");
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_USER_INFO", sFinal);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = sMsg + ex.ToString();
        }
    }

    protected void SetUserInfoPhotoFile(string sUserId, string sPhotoFullPath)
    {
        if (sUserId == null) return;
        if (sUserId == "") return;

        string sMsg = "SetUserInfo ";

        sleepState();
        try
        {
            JObject vResultJson = new JObject();
            vResultJson.Add("user_id", sUserId);
            vResultJson.Add("photofile", sPhotoFullPath);
            string sFinal = vResultJson.ToString(Formatting.None);
            while (sFinal.Contains("\r\n "))
            {
                sFinal.Replace("\r\n ", "\r\n");
            }
            sFinal.Replace("\r\n", "");
            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_USER_INFO", sFinal);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = sMsg + ex.ToString();
        }
    }

    protected void SetPriviligeBtn_Click(object sender, EventArgs e)
    {
        string sUserId = UserList.SelectedItem.Text;
        string sUserPriv = UserPriv.SelectedItem.Text;
        if (sUserId == "") return;
        if (sUserPriv == "") return;

        sleepState();
        Session["operation"] = SET_USER_PRIVILEGE;
        Session["next_user_id"] = UserList.SelectedIndex;
        
        byte[] mByteParam = new byte[0];
        try
        {
            JObject vResultJson = new JObject();
            vResultJson.Add("user_id", sUserId);
            vResultJson.Add("user_privilege", sUserPriv);

            string sFinal = vResultJson.ToString(Formatting.None);
            while (sFinal.Contains("\r\n "))
            {
                sFinal.Replace("\r\n ", "\r\n");
            }
            sFinal.Replace("\r\n", "");

            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_USER_PRIVILEGE", sFinal);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }
    }

    protected void SetNameBtn_Click(object sender, EventArgs e)
    {
        string sUserId = UserList.SelectedItem.Text;
        string sUserName = UserName.Text;
        if (sUserId == "") return;
        if (sUserName == "") return;

        sleepState();
        Session["operation"] = SET_USER_NAME;
        Session["next_user_id"] = UserList.SelectedIndex;

        byte[] mByteParam = new byte[0];
        try
        {
            JObject vResultJson = new JObject();
            vResultJson.Add("user_id", sUserId);
            vResultJson.Add("user_name", sUserName);

            string sFinal = vResultJson.ToString(Formatting.None);
            while (sFinal.Contains("\r\n "))
            {
                sFinal.Replace("\r\n ", "\r\n");
            }
            sFinal.Replace("\r\n", "");

            if (m_db == null) m_db = new FKWebDB();
            mTransIdTxt.Text = m_db.SetCommand(mDevId, "SET_USER_NAME", sFinal);
        }
        catch (Exception ex)
        {
            StatusTxt.Text = ex.ToString();
        }
    }

    protected void UserList_SelectedIndexChanged(object sender, EventArgs e)
    {
        string sUserId = UserList.SelectedItem.Text;
        StatusTxt.Text = "UserList_SelectedIndexChanged :　" + sUserId;
    }

    protected void ReadUser_Browse(int n)
    {
        ReadUser_FirstBtn.Enabled = true;
        ReadUser_LastBtn.Enabled = true;
        ReadUser_PrevBtn.Enabled = true;
        ReadUser_NextBtn.Enabled = true;
        if (n < 0) { n = 0; ReadUser_FirstBtn.Enabled = false; ReadUser_PrevBtn.Enabled = false; }
        if (n > UserList.Items.Count - 1) { n = UserList.Items.Count - 1; ReadUser_LastBtn.Enabled = false; ReadUser_NextBtn.Enabled = false; }
        UserList.SelectedIndex = n;
        //ReadUser_IndexLbl.Text = (UserList.SelectedIndex + 1) + "/" + UserList.Items.Count;

        string sUserId = UserList.SelectedItem.Text;
        StatusTxt.Text = "ReadUserInfo by  sUserId :　" + sUserId;
        DisplayUserInfo(sUserId);
    }

    protected void ReadUser_FirstBtn_Click(object sender, EventArgs e)
    {
        ReadUser_Browse(0);
    }

    protected void ReadUser_LastBtn_Click(object sender, EventArgs e)
    {
        ReadUser_Browse(UserList.Items.Count - 1);
    }

    protected void ReadUser_PrevBtn_Click(object sender, EventArgs e)
    {
        ReadUser_Browse(UserList.SelectedIndex-1);
    }

    protected void ReadUser_NextBtn_Click(object sender, EventArgs e)
    {
        ReadUser_Browse(UserList.SelectedIndex+1);
    }

    protected void SetPhotoBtn_Clicked(object sender, EventArgs e)
    {
        if (PhotoPath.Text == "")
        {
            StatusTxt.Text = "Photo Path is NOT inputed. It MUST not be EMPTY.";
            return;
        }

        // 먼저 해당기대가 얼굴식별정보를 지원하는가를 확인한다.
        if (m_db == null) m_db = new FKWebDB();
        string asDevInfo = m_db.GetDevInfo(mDevId);
        JObject vDevInfoJson = JObject.Parse(asDevInfo);
        string sSupported = vDevInfoJson["supported_enroll_data"].ToString();
        if (sSupported.Contains("FACE") == false) return;

        int new_user_id = GetNewUserID();

        // 확장자가 JPG인 화상화일들을 골라낸다.
        string sPrefix = "";
        string sSearchPattern = sPrefix + "*.jpg";

        string sPhotoPath = PhotoPath.Text;
        if (sPhotoPath.EndsWith ("\\") == false) sPhotoPath += "\\";
        string[] sAryFilePaths = Directory.GetFiles(sPhotoPath, sSearchPattern,
                                     SearchOption.TopDirectoryOnly);
        foreach (string sFileName in sAryFilePaths)
        {
            //if (sFileName.StartsWith("FKPHOTO_") == false) continue;
            SetUserInfoPhotoFile(Convert.ToString(new_user_id), sFileName);
            new_user_id++;
        }
    }
    protected void SetCardBtn_Click(object sender, EventArgs e)
    {
        mUserId = UserID.Text;
        if (UserID.Text.Length > 0)
        {
            mUserId = UserID.Text;
        }
        else
            mUserId = UserList.SelectedItem.Text;
        if (mUserId == "")
        {
            StatusTxt.Text = "UserID is Empty, please input or select UserID.";
            return;
        }

        int state = (int)Session["cur_state"];
        if (state == STATE_EDIT)
        {
            if (CardNum.Text.Length > 0)
            {
                byte[] abytEnrollData = System.Text.Encoding.Default.GetBytes(CardNum.Text);
                m_db.SetEnrollData(mDevId, mUserId, FKWebDB.BACKUP_CARD, abytEnrollData);
            }
        }


        Session["operation"] = SET_USER_INFO;
        SetUserInfo(mUserId);

    }
    protected void SetPasswordBtn_Click(object sender, EventArgs e)
    {
        mUserId = UserID.Text;
        if (UserID.Text.Length > 0)
        {
            mUserId = UserID.Text;
        }
        else
            mUserId = UserList.SelectedItem.Text;
        if (mUserId == "")
        {
            StatusTxt.Text = "UserID is Empty, please input or select UserID.";
            return;
        }

        int state = (int)Session["cur_state"];
        if (state == STATE_EDIT)
        {
            if (Password.Text.Length > 0)
            {
                byte[] abytEnrollData = System.Text.Encoding.Default.GetBytes(Password.Text);
                m_db.SetEnrollData(mDevId, mUserId, FKWebDB.BACKUP_PSW, abytEnrollData);
            }
        }


        Session["operation"] = SET_USER_INFO;
        SetUserInfo(mUserId);

    }
}
