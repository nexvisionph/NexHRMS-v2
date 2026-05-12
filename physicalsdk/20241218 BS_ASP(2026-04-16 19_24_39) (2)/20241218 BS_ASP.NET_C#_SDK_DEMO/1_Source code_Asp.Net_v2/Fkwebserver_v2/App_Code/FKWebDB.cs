using System;
using System.Collections.Generic;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Data.SqlClient;
using System.Data;
using System.Runtime.InteropServices;
using System.Threading;
using System.Configuration;
using System.IO;
using System.Diagnostics;


using log4net;
using log4net.Config;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace FKWeb
{
    public class FKWebDB
    {
        private ILog logger = log4net.LogManager.GetLogger("SiteLogger");

        static public int BACKUP_FP_0 = 0;     // Finger 1
        static public int BACKUP_FP_1 = 1;     // Finger 2
        static public int BACKUP_FP_2 = 2;     // Finger 3
        static public int BACKUP_FP_3 = 3;     // Finger 4
        static public int BACKUP_FP_4 = 4;     // Finger 5
        static public int BACKUP_FP_5 = 5;     // Finger 6
        static public int BACKUP_FP_6 = 6;     // Finger 7
        static public int BACKUP_FP_7 = 7;     // Finger 8
        static public int BACKUP_FP_8 = 8;     // Finger 9
        static public int BACKUP_FP_9 = 9;     // Finger 10
        static public int BACKUP_PSW = 10;    // Password
        static public int BACKUP_CARD = 11;    // Card
        static public int BACKUP_FACE = 12;    // Face
        static public int BACKUP_PALMVEIN_0 = 13;    // Palm vein data 0
        static public int BACKUP_PALMVEIN_1 = 14;    // Palm vein data 1
        static public int BACKUP_PALMVEIN_2 = 15;    // Palm vein data 2
        static public int BACKUP_PALMVEIN_3 = 16;    // Palm vein data 3
        static public int BACKUP_IRIS_0 = 17;    // Iris data 0
        static public int BACKUP_IRIS_1 = 18;    // Iris data 1
        static public int BACKUP_IRIS_2 = 19;    // Iris data 2
        static public int BACKUP_VEIN_0 = 20;    // VEIN data 0
        static public int BACKUP_VEIN_1 = 21;    // VEIN data 1
        static public int BACKUP_VEIN_2 = 22;    // VEIN data 2
        static public int BACKUP_VEIN_3 = 23;    // VEIN data 3
        static public int BACKUP_VEIN_4 = 24;    // VEIN data 4
        static public int BACKUP_VEIN_5 = 25;    // VEIN data 5
        static public int BACKUP_VEIN_6 = 26;    // VEIN data 6
        static public int BACKUP_VEIN_7 = 27;    // VEIN data 7
        static public int BACKUP_VEIN_8 = 28;    // VEIN data 8
        static public int BACKUP_VEIN_9 = 29;    // VEIN data 9
        static public int BACKUP_VFACE = 30;    // VISIBLE FACE
        static public int BACKUP_VEIN_11 = 31;    // VEIN data 11
        static public int BACKUP_VEIN_12 = 32;    // VEIN data 12
        static public int BACKUP_VEIN_13 = 33;    // VEIN data 13
        static public int BACKUP_VEIN_14 = 34;    // VEIN data 14
        static public int BACKUP_VEIN_15 = 35;    // VEIN data 15
        static public int BACKUP_VEIN_16 = 36;    // VEIN data 16
        static public int BACKUP_VEIN_17 = 37;    // VEIN data 17
        static public int BACKUP_VEIN_18 = 38;    // VEIN data 18
        static public int BACKUP_VEIN_19 = 39;    // VEIN data 19
        //static public int BACKUP_USER_PHOTO = 13;    // user enroll photo
        static public int BACKUP_USER_PHOTO = 50;    // user enroll photo
        static public int BACKUP_MAX = BACKUP_USER_PHOTO;


        //private const string m_sqlConn_STR = "server=.\\SQLEXPRESS1;uid=golden;pwd=golden5718;database=AttDB";    
        private const string TBL_CMD_TRANS = "tbl_fkcmd_trans";
        private const string TBL_CMD_TRANS_BIG_FIELD = "tbl_fkcmd_trans_big_field";
        private bool m_bShowDebugMsg;
        private DateTime m_dtLastLogImgFolderUpdate;
        private string m_sLogImgRootFolder;
        private string m_sFirmwareBinRootFolder;
        private string asResponseCode;
        private string m_sDbconn;

        public SqlConnection m_sqlConn;

        public FKWebDB()
        {
            const string csFuncName = "Contructor";
            string sShowDbgMsg;

            m_bShowDebugMsg = false;
            sShowDbgMsg = ConfigurationManager.AppSettings["ShowDebugMsg"];
            sShowDbgMsg.ToLower();
            if (sShowDbgMsg == "true" || sShowDbgMsg == "yes")
            {
                m_bShowDebugMsg = true;
            }

            m_sDbconn = ConfigurationManager.ConnectionStrings["SqlConnFkWeb"].ConnectionString.ToString();

            try
            {
                connect();
            }
            catch (Exception)
            {
                FKWebTools.PrintDebug(csFuncName, "Error - Not m_sqlConnected db");
                disconnect();
                asResponseCode = "ERROR_DB_CONNECT";
                return;
            }
        }

        public void PrintDebugMsg(string astrFunction, string astrMsg)
        {
            if (!m_bShowDebugMsg)
                return;

            logger.Info(astrFunction + " -- " + astrMsg);
            FKWebTools.PrintDebug(astrFunction, astrMsg);
        }

        public void connect()
        {
            if (m_sqlConn == null) m_sqlConn = new SqlConnection(m_sDbconn);
            if (m_sqlConn.State != ConnectionState.Open) m_sqlConn.Open();
            SqlConnection.ClearAllPools();
        }
        public void disconnect()
        {
            if (m_sqlConn == null) return;
            m_sqlConn.Close();
            m_sqlConn.Dispose();
        }

        public SqlCommand SetSQL(string asSql)
        {
            connect();
            SqlCommand sqlCmd = new SqlCommand(asSql, m_sqlConn);
            return sqlCmd;
        }

        public SqlDataAdapter SetSQLDataAdapter(string asSql)
        {
            connect();
            SqlDataAdapter da = new SqlDataAdapter(asSql, m_sqlConn);
            return da;
        }

        // 기대의 접속상태표를 갱신한다.
        public void SetDevice(
            string asDevId,
            string asDevName,
            string asDevInfo)
        {
            const string csFuncName = "SetDevice";

            PrintDebugMsg(csFuncName, "0 - DevId:" + asDevId + ", DevName:" + asDevName + ", DevInfo:" + asDevInfo);

            connect();
            SqlCommand sqlCmd = new SqlCommand("usp_update_device_conn_status", m_sqlConn);
            sqlCmd.CommandType = CommandType.StoredProcedure;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@dev_name", SqlDbType.VarChar).Value = asDevName;
            sqlCmd.Parameters.Add("@dev_info", SqlDbType.VarChar).Value = asDevInfo;

            sqlCmd.ExecuteNonQuery();
        }

        public void SetDevice(string asDevId)
        {
            const string csFuncName = "SetDevice";

            string sql = "UPDATE tbl_device SET regtime=GETDATE() WHERE dev_id=@dev_id";
            SqlCommand sqlCmd = new SqlCommand(sql, m_sqlConn);
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.ExecuteNonQuery();
        }

        public void SetDeviceStatus(string asDevId, string asStatus)
        {
            const string csFuncName = "SetDeviceStatus";

            string sql = "UPDATE tbl_device SET status=@status, regtime=GETDATE() WHERE dev_id=@dev_id";
            SqlCommand sqlCmd = new SqlCommand(sql, m_sqlConn);
            sqlCmd.Parameters.Add("@status", SqlDbType.VarChar).Value = asStatus;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.ExecuteNonQuery();
        }

        public int IsDeviceLive(string dev_id)
        {
            int status = 0;

            connect();

            string sql = "SELECT DateDiff(Second, regtime, GETDATE()) FROM tbl_device WHERE dev_id='" + dev_id + "'";
            SqlCommand sqlCmd = new SqlCommand(sql, m_sqlConn);
            SqlDataReader sqlReader = sqlCmd.ExecuteReader();
            if (sqlReader.HasRows)
            {
                if (sqlReader.Read())
                {
                    int ellapse = sqlReader.GetInt32(0);
                    if (ellapse < 100) status = 1;
                }
            }
            sqlReader.Close();
            return status;
        }

        public int displayDeviceLive(string dev_id, ref Image img_status, Label last_time)
        {
            img_status.ImageUrl = "./Image/redon.png";
            int status = IsDeviceLive(dev_id);
            if (status == 1)
            {
                img_status.ImageUrl = "./Image/greenon.png";
            }
            return status;
        }

        // dev_id에 해당한 기대의 상태정보로부터 이 기대로부터 올라오는 자료들을 해석하기 위한 
        //  서고의 이름을 얻는다.
        public string GetDevInfo(string asDevId)
        {
            if (asDevId == null) return "";

            string sDevInfo = "";

            connect();

            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            sSql = "SELECT detail from tbl_device WHERE dev_id=@dev_id";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

            sqlDr = sqlCmd.ExecuteReader();
            if (sqlDr.Read())
            {
                sDevInfo = FKWebTools.GetStringFromObject(sqlDr[0]);
            }

            sqlDr.Close();
            sqlCmd.Dispose();

            return sDevInfo;

        }
        public string GetDevStatus(string asDevId)
        {
            const string csFuncName = "GetDevStatus";
            PrintDebugMsg(csFuncName, "asDevId = " + asDevId);
            if (asDevId == null) return "";

            string sDevInfo = "";

            connect();

            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            sSql = "SELECT status from tbl_device WHERE dev_id=@dev_id";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

            sqlDr = sqlCmd.ExecuteReader();
            if (sqlDr.Read())
            {
                sDevInfo = FKWebTools.GetStringFromObject(sqlDr[0]);
                PrintDebugMsg(csFuncName, "sDevInfo:" + sDevInfo);
            }

            sqlDr.Close();
            sqlCmd.Dispose();

            return sDevInfo;

        }
        public string GetDevName(string asDevId)
        {
            string sDevName = "";

            connect();

            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            sSql = "SELECT name from tbl_device WHERE dev_id=@dev_id";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

            sqlDr = sqlCmd.ExecuteReader();
            if (sqlDr.Read())
            {
                sDevName = FKWebTools.GetStringFromObject(sqlDr[0]);
            }

            sqlDr.Close();
            sqlCmd.Dispose();

            return sDevName;

        }
        // dev_id에 해당한 기대의 상태정보로부터 이 기대로부터 올라오는 자료들을 해석하기 위한 
        //  서고의 이름을 얻는다.
        public string GetFKDataLibName(string asDevId)
        {
            string sDevInfo = GetDevInfo(asDevId);
            string sFKDataLib = "";

            JObject jobjDevInfo = JObject.Parse(sDevInfo);
            sFKDataLib = jobjDevInfo["fk_bin_data_lib"].ToString();

            return sFKDataLib;
        }

        public string GetFirmwareFileName(string asDevId)
        {
            string sDevInfo = GetDevInfo(asDevId);
            string sFirmwareFileName = "";

            JObject jobjDevInfo = JObject.Parse(sDevInfo);
            sFirmwareFileName = jobjDevInfo["firmware_filename"].ToString();

            return sFirmwareFileName;
        }

        //=============================================================================
        // 기대가 자기에 대해 발행된 조작자지령을 얻어갈때 호출되는 함수이다.
        public void GetMyCommand(
            string asDevId,
            out string asTransId,
            out string asCmdCode,
            out string asCmdParam)
        {
            const string csFuncName = "GetMyCommand";
            asTransId = "";
            asCmdCode = "";
            asCmdParam = "";

            connect();

            // 기대에 대해 발행된 조작자지령이 있으면 그것을 기대로 내려보낸다.
            try
            {
                SqlCommand sqlCmd = new SqlCommand("usp_receive_cmd", m_sqlConn);
                sqlCmd.CommandType = CommandType.StoredProcedure;

                sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

                SqlParameter sqlParamTransId = new SqlParameter("@trans_id", SqlDbType.VarChar);
                sqlParamTransId.Direction = ParameterDirection.Output;
                sqlParamTransId.Size = 16;
                sqlParamTransId.Value = asTransId;
                sqlCmd.Parameters.Add(sqlParamTransId);

                SqlParameter sqlParamCmdCode = new SqlParameter("@name", SqlDbType.VarChar);
                sqlParamCmdCode.Direction = ParameterDirection.Output;
                sqlParamCmdCode.Size = 32;
                sqlParamCmdCode.Value = asCmdCode;
                sqlCmd.Parameters.Add(sqlParamCmdCode);

                SqlParameter sqlParamCmdParam = new SqlParameter("@cmd_param", SqlDbType.VarChar);
                sqlParamCmdParam.Direction = ParameterDirection.Output;
                sqlParamCmdParam.Size = 256;
                sqlParamCmdParam.Value = asCmdParam;
                sqlCmd.Parameters.Add(sqlParamCmdParam);

                sqlCmd.ExecuteNonQuery();

                asTransId = Convert.ToString(sqlCmd.Parameters["@trans_id"].Value);
                if (asTransId.Length == 0)
                {
                    return;
                }

                asCmdCode = Convert.ToString(sqlCmd.Parameters["@name"].Value);
                asCmdParam = Convert.ToString(sqlCmd.Parameters["@cmd_param"].Value);

                sqlCmd.Dispose();
            }
            catch (Exception e)
            {
                asTransId = "";
                asCmdCode = "";
                asCmdParam = "";
            }
        }
        //===================================================================================
        // trans_id에 해당한 지령코드가 파라메터로 준 지령코드와 같은가 확인한다. 
        public bool GetCommand(
           string asTransId,
           out string asCmdCode,
           out string asCmdParam,
           out int anCmdState,
           out string asCmdResult
       )
        {
            asCmdCode = "";
            asCmdParam = "";
            anCmdState = -1;
            asCmdResult = "";
            bool ret = false;

            connect();

            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            sSql = "SELECT command, param, status, result_code from tbl_command WHERE id=@trans_id";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@trans_id", SqlDbType.VarChar).Value = asTransId;

            sqlDr = sqlCmd.ExecuteReader();
            if (sqlDr.Read())
            {
                asCmdCode = FKWebTools.GetStringFromObject(sqlDr[0]);
                asCmdParam = FKWebTools.GetStringFromObject(sqlDr[1]);
                anCmdState = Convert.ToInt32(FKWebTools.GetStringFromObject(sqlDr[2]));
                asCmdResult = FKWebTools.GetStringFromObject(sqlDr[3]);
                ret = true;
            }

            sqlDr.Close();
            sqlCmd.Dispose();
            return ret;
        }

        public int IsDeviceRunning(string dev_id, out string sCommand, out string sParam )
        {
            int status = 0;
            sCommand = "";
            sParam = "";

            connect();
            string sSql = "SELECT TOP 1 command, param, status from tbl_command where dev_id='" + dev_id + "' ORDER BY regtime DESC";//and status>0  
            SqlCommand sqlCmd = new SqlCommand(sSql, m_sqlConn);
            SqlDataReader sqlReader = sqlCmd.ExecuteReader();
            if (sqlReader.HasRows)
            {
                sqlReader.Read();
                sCommand = sqlReader.GetString(0);
                sParam = sqlReader.GetString(1);
                status = sqlReader.GetInt32(2);
            }
            sqlReader.Close();
            return status;
        }

        //===================================================================================
        // SQL지령이 수행되여 결과가 필요없는 간단한 지령들을 수행한다.
        public void ExecuteSimpleCmd(string asSql)
        {
            SqlCommand sqlCmd = new SqlCommand(asSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.ExecuteNonQuery();
            sqlCmd.Dispose();
        }

        //===================================================================================
        // trans_id에 해당한 지령코드가 'GET_LOG_DATA'이면 지령처리결과를 해석하여 로그자료들을 
        //  tbl_log표에 보관한다.
        //
        // 자료기지가 열려진 상태가 아니면 true를 복귀한다. 
        // trans_id에 해당한 지령코드가 'GET_LOG_DATA'가 아니면 true를 복귀한다.
        // 보관도중 오유가 발생하면 false를 복귀한다.
        public void InitDB()
        {
            const string csFuncName = "InitDB";

            connect();

            SqlCommand sqlCmd = new SqlCommand("usp_init_db", m_sqlConn);
            sqlCmd.CommandType = CommandType.StoredProcedure;
            sqlCmd.ExecuteNonQuery();
        }
        public void ClearDevice(string asDevId)
        {
            const string csFuncName = "ClearDevice";

            connect();

            SqlCommand sqlCmd = new SqlCommand("usp_init_device", m_sqlConn);
            sqlCmd.CommandType = CommandType.StoredProcedure;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

            sqlCmd.ExecuteNonQuery();
        }
        public void ClearGLog(string asDevId)
        {
            const string csFuncName = "ClearGLog";

            connect();

            SqlCommand sqlCmd = new SqlCommand("usp_init_log", m_sqlConn);
            sqlCmd.CommandType = CommandType.StoredProcedure;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

            sqlCmd.ExecuteNonQuery();
        }
        public void ClearUser(string asDevId)
        {
            const string csFuncName = "ClearUser";

            connect();

            SqlCommand sqlCmd = new SqlCommand("usp_init_user", m_sqlConn);
            sqlCmd.CommandType = CommandType.StoredProcedure;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

            sqlCmd.ExecuteNonQuery();
        }
        public void DeleteUser(string asDevId, string asUserId)
        {
            const string csFuncName = "DeleteUser";

            connect();

            SqlCommand sqlCmd = new SqlCommand("usp_delete_user", m_sqlConn);
            sqlCmd.CommandType = CommandType.StoredProcedure;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = asUserId;

            sqlCmd.ExecuteNonQuery();
        }
        public string SetCommand(string asDevId, string asCommand, string asParam)
        {
            const string csFuncName = "SetCommand";
            string asTransId = "";
            if (asParam == null) asParam = "";

            connect();

            SqlCommand sqlCmd = new SqlCommand("usp_publish_command", m_sqlConn);
            sqlCmd.CommandType = CommandType.StoredProcedure;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@name", SqlDbType.VarChar).Value = asCommand;
            sqlCmd.Parameters.Add("@param", SqlDbType.VarChar).Value = asParam;

            SqlParameter sqlParamTransId = new SqlParameter("@trans_id", SqlDbType.VarChar);
            sqlParamTransId.Direction = ParameterDirection.Output;
            sqlParamTransId.Size = 32;
            sqlParamTransId.Value = asTransId;
            sqlCmd.Parameters.Add(sqlParamTransId);

            sqlCmd.ExecuteNonQuery();

            asTransId = Convert.ToString(sqlCmd.Parameters["@trans_id"].Value);

            return asTransId;
        }
        public void SetCmdResult(string asDevId, string asTransId, string asRetCode)
        {
            const string csFuncName = "SetCmdResult";

            connect();

            SqlCommand sqlCmd = new SqlCommand("usp_set_cmd_result", m_sqlConn);
            sqlCmd.CommandType = CommandType.StoredProcedure;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@trans_id", SqlDbType.VarChar).Value = asTransId;
            sqlCmd.Parameters.Add("@return_code", SqlDbType.VarChar).Value = asRetCode;

            sqlCmd.ExecuteNonQuery();
        }
		
        public bool SetGLog(
            string asDevId,
            string asUserId,
            string asVerifyMode,
            string asIOMode,
            string asIOTime,
            byte[] abytLogImage)
        {
            const string csFuncName = "SetGLog";

            connect();

            string strSql;
            strSql = "INSERT INTO tbl_log";
            strSql = strSql + "(dev_id, user_id, verify_mode, io_mode, io_time)";
            strSql = strSql + " VALUES (";
            strSql = strSql + "@dev_id, @user_id, @verify_mode, @io_mode, @io_time)";

            SqlCommand sqlCmd = new SqlCommand(strSql, m_sqlConn);

            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = asUserId;
            sqlCmd.Parameters.Add("@verify_mode", SqlDbType.VarChar).Value = asVerifyMode;
            sqlCmd.Parameters.Add("@io_mode", SqlDbType.VarChar).Value = asIOMode;
            sqlCmd.Parameters.Add("@io_time", SqlDbType.VarChar).Value = asIOTime;

            sqlCmd.ExecuteNonQuery();

            if (abytLogImage.Length > 0)
            {
                strSql = "INSERT INTO tbl_log_image";
                strSql = strSql + "(dev_id, user_id, io_time, log_image)";
                strSql = strSql + " VALUES (";
                strSql = strSql + "@dev_id, @user_id, @io_time, @log_image)";

                sqlCmd = new SqlCommand(strSql, m_sqlConn);

                sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
                sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = asUserId;
                sqlCmd.Parameters.Add("@io_time", SqlDbType.VarChar).Value = asIOTime;
                SqlParameter sqlParamLogImg = new SqlParameter("@log_image", SqlDbType.VarBinary);
                sqlParamLogImg.Direction = ParameterDirection.Input;
                sqlParamLogImg.Size = abytLogImage.Length;
                sqlParamLogImg.Value = abytLogImage;
                sqlCmd.Parameters.Add(sqlParamLogImg);

                sqlCmd.ExecuteNonQuery();
            }

            return true;
        }

        public bool SetGLog(
            string asDevId,
            string asUserId,
            string asVerifyMode,
            string asIOMode,
            string asIOTime,
            string asTemperature,
            byte[] abytLogImage)
        {
            const string csFuncName = "SetGLog";

            connect();

            string strSql;
            strSql = "INSERT INTO tbl_log";
            strSql = strSql + "(dev_id, user_id, verify_mode, io_mode, io_time, temperature)";
            strSql = strSql + " VALUES (";
            strSql = strSql + "@dev_id, @user_id, @verify_mode, @io_mode, @io_time, @temperature)";

            SqlCommand sqlCmd = new SqlCommand(strSql, m_sqlConn);

            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = asUserId;
            sqlCmd.Parameters.Add("@verify_mode", SqlDbType.VarChar).Value = asVerifyMode;
            sqlCmd.Parameters.Add("@io_mode", SqlDbType.VarChar).Value = asIOMode;
            sqlCmd.Parameters.Add("@io_time", SqlDbType.VarChar).Value = asIOTime;
            sqlCmd.Parameters.Add("@temperature", SqlDbType.VarChar).Value = asTemperature;

            sqlCmd.ExecuteNonQuery();

            if (abytLogImage.Length > 0)
            {
                strSql = "INSERT INTO tbl_log_image";
                strSql = strSql + "(dev_id, user_id, io_time, log_image)";
                strSql = strSql + " VALUES (";
                strSql = strSql + "@dev_id, @user_id, @io_time, @log_image)";

                sqlCmd = new SqlCommand(strSql, m_sqlConn);

                sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
                sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = asUserId;
                sqlCmd.Parameters.Add("@io_time", SqlDbType.VarChar).Value = asIOTime;
                SqlParameter sqlParamLogImg = new SqlParameter("@log_image", SqlDbType.VarBinary);
                sqlParamLogImg.Direction = ParameterDirection.Input;
                sqlParamLogImg.Size = abytLogImage.Length;
                sqlParamLogImg.Value = abytLogImage;
                sqlCmd.Parameters.Add(sqlParamLogImg);

                sqlCmd.ExecuteNonQuery();
            }

            return true;
        }

        public bool SetBarcode(
            string asDevId,
            string asRegTime,
            byte[] abytBarcode)
        {
            const string csFuncName = "SetBarcode";

            connect();

            string strSql;

            if (abytBarcode.Length > 0)
            {
                strSql = "INSERT INTO tbl_barcode";
                strSql = strSql + "(dev_id, regtime, content)";
                strSql = strSql + " VALUES (";
                strSql = strSql + "@dev_id, @regtime, @content)";

                SqlCommand sqlCmd = new SqlCommand(strSql, m_sqlConn);

                sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
                sqlCmd.Parameters.Add("@regtime", SqlDbType.VarChar).Value = asRegTime;
                SqlParameter sqlParamBarcode = new SqlParameter("@content", SqlDbType.VarBinary);
                sqlParamBarcode.Direction = ParameterDirection.Input;
                sqlParamBarcode.Size = abytBarcode.Length;
                sqlParamBarcode.Value = abytBarcode;
                sqlCmd.Parameters.Add(sqlParamBarcode);

                sqlCmd.ExecuteNonQuery();
            }

            return true;
        }

        public bool SetOperation(
            string asDevId,
            string asUserID,
            string asCode,
            string asTime,
            string asDetail)
        {
            const string csFuncName = "SetOperation";

            connect();

            string strSql;

            if (asTime.Length > 0)
            {
                strSql = "INSERT INTO tbl_oper_log";
                strSql = strSql + "(dev_id, user_id, oper_code, oper_time, oper_detail, reg_time)";
                strSql = strSql + " VALUES (";
                strSql = strSql + "@dev_id, @user_id, @oper_code, @oper_time, @oper_detail, GETDATE())";

                SqlCommand sqlCmd = new SqlCommand(strSql, m_sqlConn);

                sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
                sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = asUserID;
                sqlCmd.Parameters.Add("@oper_code", SqlDbType.VarChar).Value = asCode;
                sqlCmd.Parameters.Add("@oper_time", SqlDbType.VarChar).Value = asTime;
                sqlCmd.Parameters.Add("@oper_detail", SqlDbType.VarChar).Value = asDetail;
                PrintDebugMsg(csFuncName, " " + strSql + " " + asDevId + " " + asUserID + " " + asCode + " " + asTime + " " + asDetail);

                sqlCmd.ExecuteNonQuery();
            }

            return true;
        }

        public void GetBarcode(string asDevId, out string sBarcode)
        {
            sBarcode = "";

            if (asDevId.Length == 0) return;

            connect();
            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            sSql = "SELECT content FROM tbl_barcode WHERE dev_id =@dev_id ORDER BY regtime DESC";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

            sqlDr = sqlCmd.ExecuteReader();

            /*
            if (!sqlDr.Read())
            {
                sqlDr.Close();
                sqlCmd.Dispose();
                return;
            }
            sBarcode = FKWebTools.GetStringFromObject(sqlDr[0]);
*/
            byte[] abytEnroll = new byte[0];
            if (sqlDr.HasRows)
            {
                sqlDr.Read();
                System.Data.SqlTypes.SqlBytes bytes = sqlDr.GetSqlBytes(0);
                abytEnroll = bytes.Buffer;
            }
            sBarcode = abytEnroll.ToString();

            sqlDr.Close();
            sqlCmd.Dispose();
        }

        //===================================================================================
        // trans_id에 해당한 지령코드가 'GET_USER_ID_LIST'이면 지령처리결과를 해석하여 로그자료들을 
        //  tbl_fkcmd_trans_cmd_result_user_id_list표에 보관한다.
        //
        // 자료기지가 열려진 상태가 아니면 true를 복귀한다. 
        // trans_id에 해당한 지령코드가 'GET_USER_ID_LIST'가 아니면 true를 복귀한다.
        // 보관도중 오유가 발생하면 false를 복귀한다.
        public void SetUserID(string asDevId, string sUserId, int BackupNumber)
        {
            if (asDevId.Length == 0) return;
            if (sUserId.Length == 0) return;

            connect();
            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;
            bool isNew = false;

            sSql = "SELECT backup_number from tbl_enroll WHERE dev_id =@dev_id AND user_id=@user_id AND backup_number=@backup_number";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = sUserId;
            sqlCmd.Parameters.Add("@backup_number", SqlDbType.VarChar).Value = BackupNumber;

            sqlDr = sqlCmd.ExecuteReader();
            if (!sqlDr.HasRows) isNew = true;
            sqlDr.Close();

            if (isNew == true)
            {
                sSql = "INSERT INTO tbl_enroll (dev_id, user_id, backup_number, regtime)VALUES(@dev_id, @user_id, @backup_number, GETDATE())";
                sqlCmd = new SqlCommand(sSql, m_sqlConn);
                sqlCmd.CommandType = CommandType.Text;
                sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
                sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = sUserId;
                sqlCmd.Parameters.Add("@backup_number", SqlDbType.VarChar).Value = BackupNumber;

                sqlCmd.ExecuteNonQuery();
            }
            sqlCmd.Dispose();
        }
        public void SetUser(string asDevId, string sUserId, string sName, string sPrivilege, string sNote)
        {

            const string csFuncName = "SetUser";
            PrintDebugMsg(csFuncName, "SetUser( " + asDevId + ", " + sUserId + ", " + sName + ", " + sPrivilege + ", " + sNote + " )");

            if (asDevId.Length == 0) return;
            if (sUserId.Length == 0) return;

            connect();
            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;
            PrintDebugMsg(csFuncName, "SetUser( 1 )");

            sSql = "SELECT u_id from tbl_user WHERE dev_id =@dev_id AND user_id=@user_id";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = sUserId;
            PrintDebugMsg(csFuncName, "SetUser( sql = " + sSql);

            sqlDr = sqlCmd.ExecuteReader();
            sSql = "UPDATE tbl_user SET regtime=GETDATE(), name=@name, privilige=@privilige, note=@note where dev_id =@dev_id AND user_id=@user_id";
            if (!sqlDr.HasRows)
            {
                sSql = "INSERT INTO tbl_user (dev_id, user_id, name, regtime, privilige, note)VALUES(@dev_id, @user_id, @name,GETDATE(),@privilige, @note)";
            }
            sqlDr.Close();
            PrintDebugMsg(csFuncName, "SetUser( sql = " + sSql);

            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = sUserId;
            sqlCmd.Parameters.Add("@name", SqlDbType.VarChar).Value = sName;
            sqlCmd.Parameters.Add("@privilige", SqlDbType.VarChar).Value = sPrivilege;
            sqlCmd.Parameters.Add("@note", SqlDbType.VarChar, 1000).Value = sNote;
            PrintDebugMsg(csFuncName, "SetUser( 2 )");

            sqlCmd.ExecuteNonQuery(); 
            sqlCmd.Dispose();
            PrintDebugMsg(csFuncName, "SetUser( 3 )");
        }
        public void GetUser(string asDevId, string sUserId, out string sName, out string sPrivilege, out string sNote)
        {
            sName = "";
            sPrivilege = "";
            sNote = "";

            if (asDevId.Length == 0) return;
            if (sUserId.Length == 0) return;

            connect();
            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            sSql = "SELECT name,privilige, note FROM tbl_user WHERE dev_id =@dev_id AND user_id=@user_id";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = sUserId;

            sqlDr = sqlCmd.ExecuteReader();
            if (!sqlDr.Read())
            {
                sqlDr.Close();
                sqlCmd.Dispose();
                return;
            }
            sName = FKWebTools.GetStringFromObject(sqlDr[0]);
            sPrivilege = FKWebTools.GetStringFromObject(sqlDr[1]);
            sNote = FKWebTools.GetStringFromObject(sqlDr[2]);

            sqlDr.Close();
            sqlCmd.Dispose();
        }
        public void SetEnrollData(string asDevId, string sUserId, int BackupNumber, byte[] abytEnroll)
        {
            const string csFuncName = "SetEnrollData";
            PrintDebugMsg(csFuncName, "BackupNumber : " + BackupNumber + "abytEnroll.Length : " + abytEnroll.Length);

            if (asDevId.Length == 0) return;
            if (sUserId.Length == 0) return;
            if (abytEnroll.Length == 0) return;

            connect();
            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            // 지령코드가 파라메터에 준 코드와 같은가를 알아본다.
            sSql = "SELECT backup_number from tbl_enroll WHERE dev_id =@dev_id AND user_id=@user_id AND backup_number=@backup_number";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = sUserId;
            sqlCmd.Parameters.Add("@backup_number", SqlDbType.VarChar).Value = BackupNumber;

            sqlDr = sqlCmd.ExecuteReader();
            sSql = "UPDATE tbl_enroll SET regtime=GETDATE(), content=@content where dev_id =@dev_id AND user_id=@user_id AND backup_number=@backup_number";
            if (!sqlDr.HasRows)
            {
                sSql = "INSERT INTO tbl_enroll (dev_id, user_id, backup_number, regtime, content)VALUES(@dev_id, @user_id, @backup_number,GETDATE(),@content)";
            }
            sqlDr.Close();
            PrintDebugMsg(csFuncName, "sSql : " + sSql);

            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = sUserId;
            sqlCmd.Parameters.Add("@backup_number", SqlDbType.VarChar).Value = BackupNumber;
            SqlParameter sqlParamEnrollData = new SqlParameter("@content", SqlDbType.VarBinary);
            sqlParamEnrollData.Direction = ParameterDirection.Input;
            sqlParamEnrollData.Size = abytEnroll.Length;
            sqlParamEnrollData.Value = abytEnroll;
            sqlCmd.Parameters.Add(sqlParamEnrollData);

            sqlCmd.ExecuteNonQuery();

            sqlCmd.Dispose();
        }
        public void GetEnrollData(string asDevId, string sUserId, int BackupNumber, out byte[] abytEnroll)
        {
            abytEnroll = new byte[0];

            if (asDevId.Length == 0) return;
            if (sUserId.Length == 0) return;

            connect();
            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            sSql = "SELECT content from tbl_enroll WHERE dev_id =@dev_id AND user_id=@user_id AND backup_number=@backup_number";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = sUserId;
            sqlCmd.Parameters.Add("@backup_number", SqlDbType.VarChar).Value = BackupNumber;

            sqlCmd.ExecuteNonQuery();

            sqlDr = sqlCmd.ExecuteReader();
            abytEnroll = new byte[0];
            if (sqlDr.HasRows)
            {
                sqlDr.Read();
                System.Data.SqlTypes.SqlBytes bytes = sqlDr.GetSqlBytes(0);
                abytEnroll = bytes.Buffer;
            }

            sqlDr.Close();
            sqlCmd.Dispose();
        }
        public void GetEnrollDataList(string asDevId, string sUserId, out List<EnrollData> aEnrollDataList, out bool hasPhoto)
        {
            aEnrollDataList = new List<EnrollData>();
            hasPhoto = false;

            if (asDevId.Length == 0) return;
            if (sUserId.Length == 0) return;

            connect();
            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            sSql = "SELECT backup_number, content from tbl_enroll WHERE dev_id =@dev_id AND user_id=@user_id";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@user_id", SqlDbType.VarChar).Value = sUserId;
            sqlCmd.ExecuteNonQuery();

            byte[] abytEnroll = new byte[0];
            sqlDr = sqlCmd.ExecuteReader();
            while (sqlDr.Read())
            {
                System.Data.SqlTypes.SqlBytes bytes = sqlDr.GetSqlBytes(1);
                abytEnroll = bytes.Buffer;

                if (abytEnroll == null) continue;
                if (abytEnroll.Length == 0) continue;

                EnrollData ed = new EnrollData();
                ed.BackupNumber = sqlDr.GetSqlInt32(0).Value;
                if (ed.BackupNumber == BACKUP_USER_PHOTO) hasPhoto = true;
                ed.bytData = abytEnroll;
                aEnrollDataList.Add(ed);
            }

            sqlDr.Close();
            sqlCmd.Dispose();
        }
        public void SetTransBuffer(string asDevId, int anBlk_no, byte[] abytBuffer)
        {
            if (asDevId.Length == 0) return;
            if (anBlk_no == 0) return;
            if (abytBuffer.Length == 0) return;

            connect();
            string sSql;
            SqlCommand sqlCmd;

            // 지령코드가 파라메터에 준 코드와 같은가를 알아본다.
            sSql = "INSERT INTO tbl_trans (dev_id, blk_no, buff_len, buffer)VALUES(@dev_id, @blk_no, @buff_len, @buffer)";

            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.Parameters.Add("@blk_no", SqlDbType.VarChar).Value = anBlk_no;
            sqlCmd.Parameters.Add("@buff_len", SqlDbType.VarChar).Value = abytBuffer.Length;
            SqlParameter sqlParamTransBuff = new SqlParameter("@buffer", SqlDbType.VarBinary);
            sqlParamTransBuff.Direction = ParameterDirection.Input;
            sqlParamTransBuff.Size = abytBuffer.Length;
            sqlParamTransBuff.Value = abytBuffer;
            sqlCmd.Parameters.Add(sqlParamTransBuff);

            sqlCmd.ExecuteNonQuery();

            sqlCmd.Dispose();
        }
        public int GetTransBufferLen(string asDevId)
        {
            int len_buff = 0;
            if (asDevId.Length == 0) return len_buff;

            connect();
            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;

            sSql = "SELECT buff_len from tbl_trans WHERE dev_id =@dev_id ORDER BY blk_no";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

            sqlCmd.ExecuteNonQuery();

            sqlDr = sqlCmd.ExecuteReader();

            while (sqlDr.Read())
            {
                len_buff += Convert.ToInt32(FKWebTools.GetStringFromObject(sqlDr[0]));
            }

            sqlDr.Close();
            sqlCmd.Dispose();
            return len_buff;
        }
        public void CombineTransBuffer(string asDevId, int len_buff, out byte[] abytBuffer)
        {
            abytBuffer = new byte[0];

            if (asDevId.Length == 0) return;
            if (len_buff == 0) return;

            connect();
            string sSql;
            SqlCommand sqlCmd;
            SqlDataReader sqlDr;
            byte[] tmp = new byte[0];
            abytBuffer = new byte[len_buff];

            sSql = "SELECT buffer from tbl_trans WHERE dev_id =@dev_id ORDER BY blk_no";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;

            sqlCmd.ExecuteNonQuery();

            sqlDr = sqlCmd.ExecuteReader();
            int i = 0;
            while (sqlDr.Read())
            {
                System.Data.SqlTypes.SqlBytes bytes = sqlDr.GetSqlBytes(0);
                tmp = bytes.Buffer;

                Buffer.BlockCopy(tmp, 0, abytBuffer, i, tmp.Length);
                i += tmp.Length;
            }
            sqlDr.Close();
            sqlCmd.Dispose();
        }
        public void ClearTransBuffer(string asDevId)
        {
            connect();
            string sSql;
            SqlCommand sqlCmd;

            sSql = "DELETE FROM tbl_trans WHERE dev_id =@dev_id";
            sqlCmd = new SqlCommand(sSql, m_sqlConn);
            sqlCmd.CommandType = CommandType.Text;
            sqlCmd.Parameters.Add("@dev_id", SqlDbType.VarChar).Value = asDevId;
            sqlCmd.ExecuteNonQuery();

            sqlCmd.Dispose();
        }
    }
}