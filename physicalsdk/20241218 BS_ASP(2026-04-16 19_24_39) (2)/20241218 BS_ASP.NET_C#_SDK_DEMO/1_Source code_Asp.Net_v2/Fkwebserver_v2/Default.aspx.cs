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

using FKWeb;

public class FKWebTransBlockData
{
    public int LastBlockNo;
    public DateTime TmLastModified;
    public MemoryStream MemStream;
}

public partial class _Default : System.Web.UI.Page 
{
    ILog logger = log4net.LogManager.GetLogger("SiteLogger");
    //ILog logger = log4net.LogManager.GetLogger("DebugOutLogger");

    private const string REQ_CODE_RECV_CMD = "receive_cmd";
    private const string REQ_CODE_SEND_CMD_RESULT = "send_cmd_result";
    private const string REQ_CODE_REALTIME_GLOG = "realtime_glog";
    private const string REQ_CODE_REALTIME_ENROLL = "realtime_enroll_data";
    private const string REQ_CODE_REALTIME_BARCODE = "realtime_barcode";
    private const string REQ_CODE_REALTIME_OPERATION = "realtime_operation";

    private const string REQ_TYPE_BINARY = "application/octet-stream";
    private const string REQ_TYPE_JSON = "application/json;charset=utf-8";

    protected int GetRequestStreamBytes(
        out byte [] abytReceived)
    {
        abytReceived = new byte [0];
        int lenContent = Convert.ToInt32((string)Request.Headers["Content-Length"]);
        if (lenContent < 1)
            return 0;

        Stream streamIn = Request.InputStream;
        byte [] bytRecv = new byte[lenContent];
        int     lenRead;
        string roundtrip = ""; 
        lenRead = streamIn.Read(bytRecv, 0, lenContent);
        if (lenRead != lenContent)
        {
            // 만일 읽어야 할 길이만큼 다 읽지 못하면
            return -1;
        }

        try
        {
            if (Request.Headers["encrypt"] == "yes")
            {
                byte[] myKey = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 };
                byte[] myIV = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 };
                roundtrip = FKWebTrans.DecryptStringFromBytes(bytRecv, myKey, myIV, FKWebTrans.enumEncMode.ENC_AES);
                bytRecv = Convert.FromBase64String(roundtrip);
            }

            if (Request.Headers["encrypt"] == "base64only")
            {
                byte[] myKey = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 };
                byte[] myIV = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 };
                roundtrip = FKWebTrans.DecryptStringFromBytes(bytRecv, myKey, myIV, FKWebTrans.enumEncMode.ENC_BASE64ONLY);
                //string roundtrip = "RQEAAHsiZmtfaW5mbyI6eyJmYWNlX2RhdGFfdmVyIjoxMDAsImZpcm13YXJlIjoiSUZLTDcyNjBPRjA1MDUgTklCTzEgVjIuMzAiLCJmaXJtd2FyZV9maWxlbmFtZSI6Imlma2w3MjYwb2YwNTA1X2JzX3VtIiwiZmtfYmluX2RhdGFfbGliIjoiRktEYXRhSFMxMDEiLCJmcF9kYXRhX3ZlciI6MTI4LCJpcCI6IjE5Mi4xNjguMDAxLjEwMiIsInBhbG1fZGF0YV92ZXIiOjMwNSwic3VwcG9ydGVkX2Vucm9sbF9kYXRhIjpbIlBBU1NXT1JEIiwiSURDQVJEIiwiRlAiLCJGQUNFIiwiUEFMTSJdfSwiZmtfbmFtZSI6IkZhY2VCUzEwMCIsImZrX3RpbWUiOiIyMDEwMDIyMzA2MTk1MSJ9CgA=";
                bytRecv = Convert.FromBase64String(roundtrip);
            }
        }
        catch (Exception ex)
        {
            //bytRecv = System.Text.Encoding.UTF8.GetBytes(ex.ToString());
            bytRecv = System.Text.Encoding.UTF8.GetBytes(ex.ToString() + " : " + roundtrip + " , " + roundtrip.Length + " bytes");
        }


        abytReceived = bytRecv;
        return lenContent;
    }

    protected void SendResponseToClient(
        string asResponseCode,
        string asTransId,
        string asCmdCode,
        byte[] abytRecvBuffer,
        FKWebTrans.enumEncMode anEnc)
    {
        Response.AddHeader("response_code", asResponseCode);
        Response.AddHeader("trans_id", asTransId);
        Response.AddHeader("cmd_code", asCmdCode);

        Response.ContentType = "application/octet-stream";
        Response.AddHeader("Content-Length", Convert.ToString(abytRecvBuffer.Length));
        if (anEnc == FKWebTrans.enumEncMode.ENC_AES)
            Response.AddHeader("encrypt", "yes");
        if (anEnc == FKWebTrans.enumEncMode.ENC_BASE64ONLY)
            Response.AddHeader("encrypt", "base64only");

        Response.Flush();

        if (abytRecvBuffer.Length > 0)
        {
            Stream streamOut = Response.OutputStream;
            streamOut.Write(abytRecvBuffer, 0, abytRecvBuffer.Length);
            streamOut.Close();
        }
    }

    protected void SendResponseToClient(
        string asResponseCode,
        string asTransId)
    {
        Response.AddHeader("response_code", asResponseCode);
        Response.AddHeader("trans_id", asTransId);

        Response.ContentType = "application/octet-stream";
        Response.AddHeader("Content-Length", Convert.ToString(0));
        Response.Flush();
    }

    protected void SendResponseToClient(string asResponseCode)
    {
        Response.AddHeader("response_code", asResponseCode);

        Response.ContentType = "application/octet-stream";
        Response.AddHeader("Content-Length", Convert.ToString(0));
        Response.Flush();
    }

    // 지령수행결과로 올라오는 블로크자료들을 기대별로 할당한 메모리스트림에 추가한다.
    protected int AddBlockData(string asDevId, int anBlkNo, byte [] abytBlkData)
    {
        if (asDevId.Length == 0)
            return -1; // -1 : 파라메터가 비정상

        if (anBlkNo < 1)
            return -1;

        if (abytBlkData.Length == 0)
            return -1;

        try
        {
            string app_key;            
            
            Context.Application.Lock();
            app_key = "key_dev_" + asDevId;

            if (anBlkNo == 1)
            {
                FKWebTransBlockData app_val_blk = (FKWebTransBlockData)Context.Application.Get(app_key);
                if (app_val_blk == null)
                {
                    // 이전에 해당 기대에 대한 블로크자료를 루적하기 위한 오브젝트가 창조되여 있지 않은 경우
                    //  새 오브젝트를 창조하고 Dictionary에 추가한다.
                    app_val_blk = new FKWebTransBlockData();
                    Context.Application.Add(app_key, app_val_blk);
                }
                else
                {
                    // 이전에 해당 기대에 대한 블로크자료를 루적하기 위한 오브젝트가 창조되여 있은 경우
                    //  그 오브젝트를 삭제하고 새 오브젝트를 창조한 다음 Dictionary에 추가한다.
                    Context.Application.Remove(app_key);
                    app_val_blk = new FKWebTransBlockData();
                    Context.Application.Add(app_key, app_val_blk);
                }

                // 첫 블로크자료를 블로크자료보관용 스트림에 추가한다.
                app_val_blk.LastBlockNo = 1;
                app_val_blk.TmLastModified = DateTime.Now;
                app_val_blk.MemStream = new MemoryStream();
                app_val_blk.MemStream.Write(abytBlkData, 0, abytBlkData.Length);
            }
            else
            {
                // 블로크번호가 1 이 아닌 경우
                FKWebTransBlockData app_val_blk = (FKWebTransBlockData)Context.Application.Get(app_key);
                if (app_val_blk == null)
                {
                    // 이미 기대에 대한 오브젝트가 창조되여 있지 않은 상태라면 
                    Context.Application.UnLock();
                    return -2;
                }
                if (app_val_blk.LastBlockNo != anBlkNo - 1)
                {
                    // 만일 마지막으로 받은 블로크번호가 새로 받을 블로크번호와 련속이 되지 않는다면
                    Context.Application.UnLock();
                    return -3;
                }

                // 새로 받은 블로크자료를 블로크자료보관용 스트림의 마지막에 추가한다.
                app_val_blk.LastBlockNo = anBlkNo;
                app_val_blk.TmLastModified = DateTime.Now;
                app_val_blk.MemStream.Seek(0, SeekOrigin.End);
                app_val_blk.MemStream.Write(abytBlkData, 0, abytBlkData.Length);
            }

            Context.Application.UnLock();
            return 0;
        }
        catch
        {
            Context.Application.UnLock();
            return -11;
        }
    }

    // 해당 기대에 대하여 메모리스트림에 루적된 자료를 얻어내고 그 메모리스트림을 삭제한다.
    protected int GetBlockDataAndRemove(string asDevId, out byte[] abytBlkData)
    {
        abytBlkData = new byte[0];

        if (asDevId.Length == 0)
            return -1;

        try
        {
            string app_key;

            Context.Application.Lock();
            app_key = "key_dev_" + asDevId;

            FKWebTransBlockData app_val_blk = (FKWebTransBlockData)Context.Application.Get(app_key);
            if (app_val_blk == null)
            {
                Context.Application.UnLock();
                return 0;
            }

            app_val_blk.MemStream.Seek(0, SeekOrigin.Begin);
            abytBlkData = new byte[app_val_blk.MemStream.Length];
            app_val_blk.MemStream.Read(abytBlkData, 0, abytBlkData.Length);
            Context.Application.Remove(app_key);

            Context.Application.UnLock();
            return 0;
        }
        catch
        {
            Context.Application.UnLock();
            return -11;
        }
    }

    protected void RemoveOldBlockStream()
    {
        DateTime dtCur = DateTime.Now;
        TimeSpan delta;
        try
        {
            Context.Application.Lock();

            List<string> listDevIdKey = new List<string>();
            FKWebTransBlockData app_val_blk;
            int k;
            int cnt = Context.Application.Count;            
            for (k = 0; k < cnt; k++)
            {
                string sKey = Context.Application.GetKey(k);
                if (String.Compare(sKey, 0, "key_dev_", 0, 8, true) != 0)
                    continue;

                app_val_blk = (FKWebTransBlockData)Context.Application.Get(k);
                delta = dtCur - app_val_blk.TmLastModified;
                if (delta.Minutes > 30)
                    listDevIdKey.Add(sKey);
            }
            
            foreach (string key_dev in listDevIdKey)
                Context.Application.Remove(key_dev);

            Context.Application.UnLock();
        }
        catch
        {
            Context.Application.UnLock();
        }
    }

    protected void OnReceiveCmd(FKWebTrans aCmdTrans, string asDevId, byte[] abytReuest)
    {
        const string csFuncName = "Page_Load - receive_cmd";

        string sResponse;
        string sTransId;
        byte[] bytRequest = abytReuest;
        string sCmdCode;
        string sCmdParam;
        byte[] bytSendBuff = new byte[0];

        try
        {
            // 지령접수요구가 올라올때 기대이름, 기대시간, 기대정보가
            //  body부분에 포함되여 올라오게 되여있다.
            aCmdTrans.SetDeviceLive(asDevId, bytRequest);

            aCmdTrans.ReceiveCmd(asDevId, out sTransId, out sCmdCode, out sCmdParam);
            aCmdTrans.PrintDebugMsg(csFuncName, sTransId + " : " + sCmdCode + " : " + sCmdParam);

            sResponse = "OK";

            sResponse = "ERROR_NO_CMD";
            if (sCmdCode.Length > 0)
                aCmdTrans.ProcessCommand(asDevId, sCmdCode, sCmdParam, out bytSendBuff, out sResponse);

            SendResponseToClient(
                sResponse,
                sTransId,
                sCmdCode,
                bytSendBuff,
                aCmdTrans.GetEncMode());
        }
        catch (Exception ex)
        {
            aCmdTrans.PrintDebugMsg(csFuncName, "Except - " + ex.ToString());
            // 지령접수처리과정에 exception이 발생하면 접속을 차단한다.                
            Response.Close();
            return;
        }
    }

    protected void OnSendCmdResult(FKWebTrans aCmdTrans, string asDevId, string asTransId, byte[] abytRequest)
    {
        const string csFuncName = "Page_Load - send_cmd_result";

        byte[] bytCmdResult = abytRequest;
        string fn = "D:\\FKBS_DEBUG_RESULT.DAT";
        if (!File.Exists(fn)) FKWebTools.SaveToFile(fn, abytRequest);        

        string sResponse;
        string sTransId;
        string sReturnCode;

        sTransId = asTransId;

        try
        {
            sReturnCode = Request.Headers["cmd_return_code"].ToString();

            // 지령처리결과자료를 자료기지에 보관한다.
            aCmdTrans.ProcessCmdResult(sTransId, asDevId, sReturnCode, bytCmdResult, out sResponse);

            // HTTP클라이언트에 응답을 보낸다.
            SendResponseToClient(sResponse, sTransId);

        }
        catch (Exception ex)
        {
            aCmdTrans.PrintDebugMsg(csFuncName, "Except - " + ex.ToString());
            // exception이 발생하면 접속을 차단한다.                
            Response.Close();
            return;
        }
    }

    protected void OnRealtimeGLog(FKWebTrans aCmdTrans, string asDevId, byte[] abytRequest)
    {
        const string csFuncName = "OnRealtimeGLog";

        string sResponse = "OK";
        if (aCmdTrans.SaveRTLog(asDevId, abytRequest) == false)
        {
            sResponse = "ERROR_DB_ACCESS";
            aCmdTrans.PrintDebugMsg(csFuncName, sResponse);
        }

        SendResponseToClient(sResponse);
    }

    protected void OnRealtimeEnrollData(FKWebTrans aCmdTrans, string asDevId, byte[] abytRequest)
    {
        const string csFuncName = "OnRealtimeEnrollData";
        aCmdTrans.PrintDebugMsg(csFuncName, "abytRequest length = " + abytRequest.Length);

        string sResponse = "OK";

        if (aCmdTrans.SaveUserInfo(asDevId, abytRequest) == false) {
            sResponse = "ERROR_DB_ACCESS";
            aCmdTrans.PrintDebugMsg(csFuncName, sResponse);
        }

        SendResponseToClient(sResponse);
    }


    protected void OnRealtimeBarcode(FKWebTrans aCmdTrans, string asDevId, byte[] abytRequest)
    {
        const string csFuncName = "OnRealtimeBarcode";
        aCmdTrans.PrintDebugMsg(csFuncName, "abytRequest length = " + abytRequest.Length);

        string sResponse = "OK";

        if (aCmdTrans.SaveRTBarcode(asDevId, abytRequest) == false)
        {
            sResponse = "ERROR_DB_ACCESS";
            aCmdTrans.PrintDebugMsg(csFuncName, sResponse);
        }

        SendResponseToClient(sResponse);
    }

    protected void OnRealtimeOperation(FKWebTrans aCmdTrans, string asDevId, byte[] abytRequest)
    {
        const string csFuncName = "OnRealtimeOperation";
        aCmdTrans.PrintDebugMsg(csFuncName, "abytRequest length = " + abytRequest.Length);

        string sResponse = "OK";

        if (aCmdTrans.SaveRTOperation(asDevId, abytRequest) == false)
        {
            sResponse = "ERROR_DB_ACCESS";
            aCmdTrans.PrintDebugMsg(csFuncName, sResponse);
        }

        SendResponseToClient(sResponse);
    }

    protected void Page_Load(object sender, EventArgs e)
    {
        const string csFuncName = "Page_Load";
        string sDevId = null;
        string sTransId = null;
        string sRequestCode = null;
        string sRequestType = null;
        int lenContent = 0;
        byte[] bytRequestBin;
        byte[] bytRequestTotal;
        int nBlkNo = 0;
        int nBlkLen = 0;

        //sDevId = "1812220002";
        //sTransId = "1234567890";
        //sRequestCode = "RECEIVE COMMAND";

        //Response.Write("OK");
        sRequestType = Request.Headers["Content-Type"];
        if (sRequestType == REQ_TYPE_BINARY)
        {
            sDevId = Request.Headers["dev_id"];
            sRequestCode = Request.Headers["request_code"];
            try { sTransId = Request.Headers["trans_id"]; }
            catch (Exception) { sTransId = ""; }
            nBlkNo = Convert.ToInt32(Request.Headers["blk_no"]);
            nBlkLen = Convert.ToInt32(Request.Headers["blk_len"]);
            lenContent = GetRequestStreamBytes(out bytRequestBin);
         }
        else if (sRequestType == REQ_TYPE_JSON) //REQ_TYPE_JSON mode
        {
            lenContent = GetRequestStreamBytes(out bytRequestBin);
            string vsJson = System.Text.Encoding.UTF8.GetString(bytRequestBin, 0, lenContent);
            try
            {
                JObject jobjRequest = JObject.Parse(vsJson);
                if (vsJson.Contains("dev_id") == true) sDevId = jobjRequest["dev_id"].ToString();
                if (vsJson.Contains("request_code") == true) sRequestCode = jobjRequest["request_code"].ToString();
                if (vsJson.Contains("trans_id") == true) sTransId = jobjRequest["trans_id"].ToString();
                if (vsJson.Contains("blk_no") == true) nBlkNo = Convert.ToInt32(jobjRequest["blk_no"].ToString());
                if (vsJson.Contains("blk_len") == true) nBlkLen = Convert.ToInt32(jobjRequest["blk_len"].ToString());
                if (vsJson.Contains("block") == true)
                {
                    bytRequestBin = Convert.FromBase64String(jobjRequest["block"].ToString());
                    lenContent = nBlkLen;
                    //SendResponseToClient("OK", sDevId);
                }
            }
            catch (Exception)
            {
//                Response.Redirect("Default2.aspx");
                SendResponseToClient("OK2", vsJson);
                return;
            }
        }
        else
        {
            Response.Redirect("Default2.aspx");
            return;
        }
        //lenContent = GetRequestStreamBytes(out bytRequestTotal);

        if (sDevId == null)
        {
            Response.Redirect("Default2.aspx");
            return;
        }

        FKWebTrans cmdTrans = new FKWebTrans(sDevId);
        if (Request.Headers["encrypt"] == "yes") cmdTrans.SetEncMode(FKWebTrans.enumEncMode.ENC_AES);
        if (Request.Headers["encrypt"] == "base64only") cmdTrans.SetEncMode(FKWebTrans.enumEncMode.ENC_BASE64ONLY);
        //cmdTrans.PrintDebugMsg(csFuncName, "bytRequestBin : " + System.Text.Encoding.UTF8.GetString(bytRequestBin));
           
        cmdTrans.PrintDebugMsg(csFuncName, "request_code : " + sRequestCode);

        if (sRequestCode == null)
        {
            cmdTrans.PrintDebugMsg(csFuncName, "error - Invalid request_code : " + sRequestCode);
            Response.Close();
            return;
        }
        // HTTP POST요구와 함께 올라오는 바이너리 자료를 수신한다.
        if (lenContent < 0)
        {
            // 만일 HTTP 헤더의 Content-Length만한 바이트를 다 접수하지 못한 경우는 접속을 차단한다.
            Response.Close();
            return;
        }

        if (nBlkNo < 0) // 비정상적인 HTTP요구(블로크번호가 무효한 값)가 올라온 경우이다.
        {
            SendResponseToClient("ERROR_INVLAID_BLOCK_NO", sTransId);
            return;
        }
        if (nBlkNo > 0)// 블로크번호가 1 이상인 경우는 해당 블로크에 대한 자료를  Web App범위에서 관리되는 기대에 대한 메모리스트림에 추가한다.
        {
            cmdTrans.SaveTransBuff(sDevId, nBlkNo, bytRequestBin);

            SendResponseToClient("OK", sTransId);
            return;
        }
        //if (nBlkNo == 0)
        // 기대측에서 결과자료를 보낼때 마지막 블로크를 보냈다면
        //  메모리스트림에 루적하였던 자료를 얻어내여 그 뒤에 최종으로 받은 블로크를 덧붙인다.
        cmdTrans.GetTransBuff(sDevId, bytRequestBin, out bytRequestTotal);

        if (sRequestCode == REQ_CODE_RECV_CMD)
        {
            // 블로크자료를 접수하기 위하여 창조하였던 스트림오브젝트가 지내 이전에 만들어진것이면
            //  그것을 삭제한다. 이러한 상황은 기대가 블로크자료를 올려보내던 도중 정전과 같은 이상현상으로 죽어버린 이후로부터
            //  현재까지 아무런 요구도 보내지 않으면 발생한다.
            OnReceiveCmd(cmdTrans, sDevId, bytRequestTotal);
            return;
        }
        if (sRequestCode == REQ_CODE_SEND_CMD_RESULT)
        {
            OnSendCmdResult(cmdTrans, sDevId, sTransId, bytRequestTotal);
            return;
        }
        if (sRequestCode == REQ_CODE_REALTIME_GLOG)
        {
            OnRealtimeGLog(cmdTrans, sDevId, bytRequestTotal);
            return;
        }
        if (sRequestCode == REQ_CODE_REALTIME_ENROLL)
        {
            OnRealtimeEnrollData(cmdTrans, sDevId, bytRequestTotal);
            return;
        }
        if (sRequestCode == REQ_CODE_REALTIME_BARCODE)
        {
            OnRealtimeBarcode(cmdTrans, sDevId, bytRequestTotal);
            return;
        }
        if (sRequestCode == REQ_CODE_REALTIME_OPERATION)
        {
            OnRealtimeOperation(cmdTrans, sDevId, bytRequestTotal);
            return;
        }

        SendResponseToClient("ERROR_INVLAID_REQUEST_CODE", sTransId);
        return;
    }
}
