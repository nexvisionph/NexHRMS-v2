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

using System.Security.Cryptography;
//public abstract class Aes : System.Security.Cryptography.SymmetricAlgorithm

namespace FKWeb
{
	public class FKWebTrans
	{
	    private ILog logger = log4net.LogManager.GetLogger("SiteLogger");

	    //private const string m_sqlConn_STR = "server=.\\SQLEXPRESS1;uid=golden;pwd=golden5718;database=AttDB";    
	    private const string TBL_CMD_TRANS = "tbl_fkcmd_trans";
	    private const string TBL_CMD_TRANS_BIG_FIELD = "tbl_fkcmd_trans_big_field";
	    private bool m_bShowDebugMsg;
        private DateTime m_dtLastLogImgFolderUpdate;
        private string m_sLogImgRootFolder;
        private string m_sFirmwareBinRootFolder;
        public FKWebDB m_db;
        private string asResponseCode;
        private int DstFpDataVer;

        //private string sDevName;
        //private string sDevTime;
        private string sDevInfo;
        private string sFKDataLib;
        private static enumEncMode nEncMode;

        public enum enumEncMode
        {
            ENC_NONE = 0,
            ENC_AES = 1,
            ENC_BASE64ONLY = 2,
        }

	    public FKWebTrans(string asDevid)
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

            m_dtLastLogImgFolderUpdate = DateTime.Now;
            m_sLogImgRootFolder = ConfigurationManager.AppSettings["LogImgRootDir"];
            m_sFirmwareBinRootFolder = ConfigurationManager.AppSettings["FirmwareBinDir"];

            try
            {
                m_db = new FKWebDB();
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
            }

            nEncMode = enumEncMode.ENC_NONE;
	    }

        public void SetEncMode(enumEncMode anEncMode)
        {
            nEncMode = anEncMode;
        }

        public enumEncMode GetEncMode()
        {
            return nEncMode;
        }

        public void SaveTransBuff(
           string asDevId,
           int anBlk_no,
           byte[] abytRecvBuff)
        {
            const string csFuncName = "SaveTransBuff";
            try
            {
                if (m_db == null) m_db = new FKWebDB();

                m_db.SetTransBuffer(asDevId, anBlk_no, abytRecvBuff);

            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
            }
        }

        public void GetTransBuff(
           string asDevId,
           byte[] abytRecvBuff,
           out byte[] abytTotalBuff)
        {
            const string csFuncName = "GetTransBuff";
            abytTotalBuff = new byte[0];

            if (asDevId.Length == 0) return;

            int buff_len = 0;
            try
            {
                if (m_db == null) m_db = new FKWebDB();
                buff_len = m_db.GetTransBufferLen(asDevId);
                PrintDebugMsg(csFuncName, " last buff_len = " + buff_len);

                abytTotalBuff = new byte[buff_len + abytRecvBuff.Length];
                if (buff_len > 0) { 
                    byte[] abytLastBuffer = new byte[0];
                    m_db.CombineTransBuffer(asDevId, buff_len, out abytLastBuffer);

                    m_db.ClearTransBuffer(asDevId);

                    Buffer.BlockCopy(abytLastBuffer, 0, abytTotalBuff, 0, abytLastBuffer.Length);
                }
                Buffer.BlockCopy(abytRecvBuff, 0, abytTotalBuff, buff_len, abytRecvBuff.Length);

                string fn = "D:\\FKBS_DEBUG_REQUEST.DAT";
                if (!File.Exists(fn)) FKWebTools.SaveToFile(fn, abytRecvBuff);
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
            }
        }
        public static byte[] EncryptStringToBytes(string plainText, byte[] Key, byte[] IV)
        {
            if (nEncMode == enumEncMode.ENC_BASE64ONLY)
            {
                 return System.Text.Encoding.UTF8.GetBytes(plainText);
            }


            // Check arguments.
            if (plainText == null || plainText.Length <= 0)
                throw new ArgumentNullException("plainText");
            if (Key == null || Key.Length <= 0)
                throw new ArgumentNullException("Key");
            if (IV == null || IV.Length <= 0)
                throw new ArgumentNullException("IV");
            byte[] encrypted;
            // Create an Rijndael object
            // with the specified key and IV.
            using (Rijndael rijAlg = Rijndael.Create())
            {
                rijAlg.Key = Key;
                rijAlg.IV = IV;
                rijAlg.Mode = CipherMode.ECB;
                rijAlg.Padding = PaddingMode.PKCS7;


                // Create an encryptor to perform the stream transform.
                ICryptoTransform encryptor = rijAlg.CreateEncryptor(rijAlg.Key, rijAlg.IV);

                // Create the streams used for encryption.
                using (MemoryStream msEncrypt = new MemoryStream())
                {
                    using (CryptoStream csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write))
                    {
                        using (StreamWriter swEncrypt = new StreamWriter(csEncrypt))
                        {

                            //Write all data to the stream.
                            swEncrypt.Write(plainText);
                        }
                        encrypted = msEncrypt.ToArray();
                    }
                }
            }

            // Return the encrypted bytes from the memory stream.
            return encrypted;
        }

        public static string DecryptStringFromBytes(byte[] cipherText, byte[] Key, byte[] IV, enumEncMode anEncMode)
        {
            if (anEncMode == enumEncMode.ENC_BASE64ONLY)
            {
                //return System.Text.Encoding.UTF8.GetString(cipherText);
                //return System.Text.Encoding.UTF8.GetString(cipherText, 0, cipherText.Length);
                //return System.Text.Encoding.Default.GetString(cipherText);
                return System.Text.Encoding.Default.GetString(cipherText).TrimEnd('\0');
            }

            // Check arguments.
            if (cipherText == null || cipherText.Length <= 0)
                throw new ArgumentNullException("cipherText");
            if (Key == null || Key.Length <= 0)
                throw new ArgumentNullException("Key");
            if (IV == null || IV.Length <= 0)
                throw new ArgumentNullException("IV");

            // Declare the string used to hold
            // the decrypted text.
            string plaintext = null;

            // Create an Rijndael object
            // with the specified key and IV.
            using (Rijndael rijAlg = Rijndael.Create())
            {
                rijAlg.Key = Key;
                rijAlg.IV = IV;
                rijAlg.Mode = CipherMode.ECB;
                rijAlg.Padding = PaddingMode.PKCS7;

                // Create a decryptor to perform the stream transform.
                ICryptoTransform decryptor = rijAlg.CreateDecryptor(rijAlg.Key, rijAlg.IV);

                // Create the streams used for decryption.
                using (MemoryStream msDecrypt = new MemoryStream(cipherText))
                {
                    using (CryptoStream csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read))
                    {
                        using (StreamReader srDecrypt = new StreamReader(csDecrypt))
                        {

                            // Read the decrypted bytes from the decrypting stream
                            // and place them in a string.
                            plaintext = srDecrypt.ReadToEnd();
                        }
                    }
                }
            }

            return plaintext;
        }
        /*
        static byte[] EncryptStringToBytes_Aes(string plainText, byte[] Key, byte[] IV)
        {
            // Check arguments.
            if (plainText == null || plainText.Length <= 0)
                throw new ArgumentNullException("plainText");
            if (Key == null || Key.Length <= 0)
                throw new ArgumentNullException("Key");
            if (IV == null || IV.Length <= 0)
                throw new ArgumentNullException("IV");
            byte[] encrypted;

            // Create an Aes object
            // with the specified key and IV.
            using (Aes aesAlg = Aes.Create())
            {
                aesAlg.Key = Key;
                aesAlg.IV = IV;

                // Create an encryptor to perform the stream transform.
                ICryptoTransform encryptor = aesAlg.CreateEncryptor(aesAlg.Key, aesAlg.IV);

                // Create the streams used for encryption.
                using (MemoryStream msEncrypt = new MemoryStream())
                {
                    using (CryptoStream csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write))
                    {
                        using (StreamWriter swEncrypt = new StreamWriter(csEncrypt))
                        {
                            //Write all data to the stream.
                            swEncrypt.Write(plainText);
                        }
                        encrypted = msEncrypt.ToArray();
                    }
                }
            }

            // Return the encrypted bytes from the memory stream.
            return encrypted;
        }

        static string DecryptStringFromBytes_Aes(byte[] cipherText, byte[] Key, byte[] IV)
        {
            // Check arguments.
            if (cipherText == null || cipherText.Length <= 0)
                throw new ArgumentNullException("cipherText");
            if (Key == null || Key.Length <= 0)
                throw new ArgumentNullException("Key");
            if (IV == null || IV.Length <= 0)
                throw new ArgumentNullException("IV");

            // Declare the string used to hold
            // the decrypted text.
            string plaintext = null;

            // Create an Aes object
            // with the specified key and IV.
            using (Aes aesAlg = Aes.Create())
            {
                aesAlg.Key = Key;
                aesAlg.IV = IV;

                // Create a decryptor to perform the stream transform.
                ICryptoTransform decryptor = aesAlg.CreateDecryptor(aesAlg.Key, aesAlg.IV);

                // Create the streams used for decryption.
                using (MemoryStream msDecrypt = new MemoryStream(cipherText))
                {
                    using (CryptoStream csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read))
                    {
                        using (StreamReader srDecrypt = new StreamReader(csDecrypt))
                        {

                            // Read the decrypted bytes from the decrypting stream
                            // and place them in a string.
                            plaintext = srDecrypt.ReadToEnd();
                        }
                    }
                }
            }

            return plaintext;
        }
        */
        //
        // The format of BSComm Binary data
        //
        // | length_json_string | string_data   |0| length_bin1_data | bin1_data | length_bin2_data | bin2_data |
        //----------------------------------------------------------------------------------------------------------
        // |   4 byte           | (len_json - 1)|1|   4 byte         | len_bin1  |   4 byte         | len_bin2  |
        //
        //===============================================================================
        // BS통신에 리용되는 바퍼로부터 문자렬에 해당한 부분을 읽어내여 그 문자렬을 복귀한다.
        static public string GetJsonBlock(byte[] abytBSComm)
        {
            string sRet = "";
            if (abytBSComm.Length < 4) return sRet;

            try
            {
                int lenText = BitConverter.ToInt32(abytBSComm, 0);
                if (lenText > abytBSComm.Length - 4) return sRet;
                if (lenText == 0) return sRet;

                sRet = System.Text.Encoding.UTF8.GetString(abytBSComm, 4, lenText);
                if (abytBSComm[4 + lenText - 1] == 0) // if last value of string buufer is 0x0
                    sRet = System.Text.Encoding.UTF8.GetString(abytBSComm, 4, lenText - 1);
            }
            catch
            {
            }
            return sRet;
       }

        static public bool SetJsonBlock(string asCmdParamText, out byte[] abytBuffer)
        {
            abytBuffer = new byte[0];

            try
            {
                if (asCmdParamText.Length == 0)
                    return true;

                if (nEncMode == enumEncMode.ENC_AES || nEncMode == enumEncMode.ENC_BASE64ONLY)
                {
                    byte[] myKey = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 };
                    byte[] myIV = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 };
                    asCmdParamText = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(asCmdParamText));
                    byte[] bytText = EncryptStringToBytes(asCmdParamText, myKey, myIV);

                    byte[] bytTextLen = BitConverter.GetBytes(Convert.ToUInt32(bytText.Length + 1));
                    abytBuffer = new byte[4 + bytText.Length + 1];
                    bytTextLen.CopyTo(abytBuffer, 0);
                    bytText.CopyTo(abytBuffer, 4);
                    abytBuffer[4 + bytText.Length] = 0;
                    return true;

                }
                else
                {
                    // 문자렬자료를 바이트배렬로 변환하고 마지막에 0을 붙인다. 그리고 그 길이를 문자렬자료길이로 본다.
                    // 전송할 파라메터바이트배렬의 첫 4바이트는 문자렬자료의 길이를 나타낸다.
                    byte[] bytText = System.Text.Encoding.UTF8.GetBytes(asCmdParamText);
                    byte[] bytTextLen = BitConverter.GetBytes(Convert.ToUInt32(bytText.Length + 1));
                    abytBuffer = new byte[4 + bytText.Length + 1];
                    bytTextLen.CopyTo(abytBuffer, 0);
                    bytText.CopyTo(abytBuffer, 4);
                    abytBuffer[4 + bytText.Length] = 0;
                    return true;
                }

            }
            catch
            {
                abytBuffer = new byte[0];
                return false;
            }
        }

        static public void AppendBinaryBlock(ref byte[] abytBSComm, byte[] abytToAdd)
        {
            try
            {
                byte[] bytBSComm = (byte[])abytBSComm;
                byte[] bytToAdd = (byte[])abytToAdd;

                if (bytToAdd.Length == 0)
                    return;

                if (nEncMode == enumEncMode.ENC_AES || nEncMode == enumEncMode.ENC_BASE64ONLY)
                {
                    byte[] myKey = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 };
                    byte[] myIV = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 };
                    string base64tmp = Convert.ToBase64String(abytToAdd);
                    byte[] encrypted = EncryptStringToBytes(base64tmp, myKey, myIV);

                    int len_dest = bytBSComm.Length + 4 + encrypted.Length;
                    byte[] bytRet = new byte[len_dest];
                    byte[] bytAddLen = BitConverter.GetBytes(Convert.ToUInt32(encrypted.Length));
                    Buffer.BlockCopy(bytBSComm, 0, bytRet, 0, bytBSComm.Length);
                    Buffer.BlockCopy(bytAddLen, 0, bytRet, bytBSComm.Length, 4);
                    Buffer.BlockCopy(encrypted, 0, bytRet, bytBSComm.Length + 4, encrypted.Length);
                    abytBSComm = bytRet;
                    return;
                }
                else {
                    int len_dest = bytBSComm.Length + 4 + bytToAdd.Length;
                    byte[] bytRet = new byte[len_dest];
                    byte[] bytAddLen = BitConverter.GetBytes(Convert.ToUInt32(bytToAdd.Length));
                    Buffer.BlockCopy(bytBSComm, 0, bytRet, 0, bytBSComm.Length);
                    Buffer.BlockCopy(bytAddLen, 0, bytRet, bytBSComm.Length, 4);
                    Buffer.BlockCopy(bytToAdd, 0, bytRet, bytBSComm.Length + 4, bytToAdd.Length);
                    abytBSComm = bytRet;
                    return;
                }
            }
            catch (Exception)
            {
                return;
            }
        }

        public static byte[] GetBinaryBlock(int anOrder, byte[] abytBSComm)
        {
            byte[] bytEmpty = new byte[0];

            try
            {
                // Convert SQLSever Data types to C# data types
                // SQLSever Data type (varbinary) <-> C# data type (byte [])
                byte[] bytBSComm = (byte[])abytBSComm;
                if (bytBSComm.Length < 4)
                    return bytEmpty;

                if (anOrder < 1 || anOrder > 255)
                    return bytEmpty;

                int orderBin;
                int posBin;
                int lenBin;
                int lenText = BitConverter.ToInt32(bytBSComm, 0);
                if (lenText > bytBSComm.Length - 4)
                    return bytEmpty;

                posBin = 4 + lenText;
                orderBin = 0;
                while (true)
                {
                    if (posBin > bytBSComm.Length - 4)
                        return bytEmpty;

                    lenBin = BitConverter.ToInt32(bytBSComm, posBin);
                    if (lenBin > bytBSComm.Length - posBin - 4)
                        return bytEmpty;

                    orderBin++;
                    if (orderBin == anOrder)
                        break;

                    posBin = posBin + 4 + lenBin;
                }

                byte[] bytRet = new byte[lenBin];
                Buffer.BlockCopy(
                    bytBSComm, posBin + 4,
                    bytRet, 0,
                    lenBin);
                return bytRet;
            }
            catch (Exception)
            {
                return bytEmpty;
            }
        }


        public void PrintDebugMsg(string astrFunction, string astrMsg)
	    {
	        if (!m_bShowDebugMsg)
	            return;

	        logger.Info(astrFunction + " -- " + astrMsg);
	        FKWebTools.PrintDebug(astrFunction, astrMsg);
	    }

        public void SetDeviceLive(
            string asDevId,
            byte[] abytRecvBuff)
        {
            const string csFuncName = "SetDeviceLive";
            //PrintDebugMsg(csFuncName, asDevId);

            if (asDevId.Length == 0) return;
            if (abytRecvBuff.Length == 0) return;

            string vsJson = GetJsonBlock(abytRecvBuff);
            //PrintDebugMsg(csFuncName, vsJson);
            try
            {
                JObject jobjRequest = JObject.Parse(vsJson);
                string sDevName = "";
                string sDevInfo = "";
                if (vsJson.Contains("fk_name") == true) sDevName = jobjRequest["fk_name"].ToString();
                if (vsJson.Contains("fk_info") == true) sDevInfo = jobjRequest["fk_info"].ToString(Newtonsoft.Json.Formatting.None);
                //PrintDebugMsg(csFuncName, sDevName);

                if (m_db == null) m_db = new FKWebDB();
                if (sDevName.Length == 0) { sDevName = asDevId; /* m_db.SetDevice(asDevId); return; */ }
                if (sDevInfo.Length == 0) { m_db.SetDevice(asDevId); return; }
                m_db.SetDevice(asDevId, sDevName, sDevInfo);


/*
                //System.Security.Cryptography.Rijndael.Create();
                //string original = "Here is some data to encrypt!";
                string original = vsJson;

                // Create a new instance of the Rijndael
                // class.  This generates a new key and initialization
                // vector (IV).
                //System.Security.Cryptography.Rijndael Supported on .NET Framework v1.1 or later
                using (Rijndael myRijndael = Rijndael.Create())
                {
                    // Encrypt the string to an array of bytes.
                    byte[] myKey = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 };
                    byte[] myIV = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 };
                    //byte[] encrypted = EncryptStringToBytes(original, myRijndael.Key, myRijndael.IV);
                    byte[] encrypted = EncryptStringToBytes(original, myKey, myIV);

                    // Decrypt the bytes to a string.
                    //string roundtrip = DecryptStringFromBytes(encrypted, myRijndael.Key, myRijndael.IV);
                    string roundtrip = DecryptStringFromBytes(encrypted, myKey, myIV);

                    //Display the original data and the decrypted data.
                    PrintDebugMsg("SetDeviceLive ", "Original:   { " + original.Length + " => " + encrypted.Length + " }" + original + ", " + myRijndael.Key);
                    PrintDebugMsg("SetDeviceLive ", "Round Trip:   {" + roundtrip.Length + "}" + roundtrip + ", " + myRijndael.IV);

                    for (int i = 0; i < myRijndael.Key.Length; i++) PrintDebugMsg("myRijndael.Key : ", "key["+i+"] " + myRijndael.Key[i]);
                    for (int i = 0; i < myRijndael.IV.Length; i++) PrintDebugMsg("myRijndael.IV : ", "IV[" + i + "] " + myRijndael.IV[i]);
                    for (int i = 0; i < encrypted.Length; i++) PrintDebugMsg("encrypted : ", "encrypted[" + i + "] " + encrypted[i]);
                }
*/
                /*
                 * 
                //System.Security.Cryptography.Aes Supported on .NET Framework v3.5 or later.
                // but this project is on .NET Framework v2.0. :@kks 2023.11.7
                using (Aes myAes = Aes.Create())
                {

                    // Encrypt the string to an array of bytes.
                    byte[] encrypted = EncryptStringToBytes_Aes(original, myAes.Key, myAes.IV);

                    // Decrypt the bytes to a string.
                    string roundtrip = DecryptStringFromBytes_Aes(encrypted, myAes.Key, myAes.IV);

                    //Display the original data and the decrypted data.
                    Console.WriteLine("Original:   {0}", original);
                    Console.WriteLine("Round Trip: {0}", roundtrip);
                }
                */

            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
            }

        }
        public void GetDeviceVersion(string asDevId)
        {
            const string csFuncName = "GetDeviceVersion";
            try
            {
                if (m_db == null) m_db = new FKWebDB();
                if (sDevInfo == null) sDevInfo = m_db.GetDevInfo(asDevId);
                if (sDevInfo.Length == 0) return;

                JObject jobjDevInfo = JObject.Parse(sDevInfo);
                DstFpDataVer = Convert.ToInt32(jobjDevInfo["fp_data_ver"]);
                sFKDataLib = jobjDevInfo["fk_bin_data_lib"].ToString();
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString() + sDevInfo);
            }

        }
        //======================================================================================
        // 만일 "기대시간동기"지령이 발행되였다면 
        //  서버의 현재시간을 얻어 파라메터자료를 만든다.
        public void LoadCurrentTime(ref byte[] abytSendBuff)
	    {
            abytSendBuff = new byte[0];
	        string sCmdParam = "{\"time\":\"" + FKWebTools.GetFKTimeString14(DateTime.Now) + "\"}";
	        SetJsonBlock(sCmdParam, out abytSendBuff);
	    }

        //======================================================================================
        // 만일 "펌웨어갱신"지령이 발행되였다면
        //  지적된 등록부에서 가장 최신판본의 펌웨어를 선택하여 파라메터를 만든다.
        public bool LoadFirmware(
            string asDevId,
            ref byte[] abytSendBuff)
        {
            const string csFuncName = "LoadFirmware";

            PrintDebugMsg(csFuncName, "1 - ");

            // 파라메터자료를 초기화한다.
            abytSendBuff = new byte[0];

            if (m_db == null) m_db = new FKWebDB();
            string asDevInfo = m_db.GetDevInfo(asDevId);

            // 먼저 해당기대에 대한 정보로부터 펌웨어파일이름의 앞붙이를 얻는다.
            JObject jobjDevInfo = JObject.Parse(asDevInfo);
            string sPrefix = jobjDevInfo["firmware_filename"].ToString();

            string sSearchPattern = sPrefix + "*.bin";
            string sUpdateFirmwareFile;
            m_sFirmwareBinRootFolder += "\\";
            string[] sAryFilePaths = Directory.GetFiles(m_sFirmwareBinRootFolder, sSearchPattern,
                                         SearchOption.TopDirectoryOnly);

            sUpdateFirmwareFile = "";
            foreach (string sFileName in sAryFilePaths)
            {
                if (string.Compare(sFileName, sUpdateFirmwareFile, false) > 0) // 파일문자렬을 비교하여 보다 큰 문자렬을 취한다.
                    sUpdateFirmwareFile = sFileName;
            }

            // 만일 update할 펌웨어파일을 찾지 못하였다면 해당 지령을 취소한다.
            if (sUpdateFirmwareFile.Length == 0)
            {
                return false;
            }

            FileStream fs = new FileStream(sUpdateFirmwareFile, FileMode.Open, FileAccess.Read);
            byte[] bytFirmwareBin = new byte[fs.Length];
            fs.Read(bytFirmwareBin, 0, (int)fs.Length);
            fs.Close();

            // cmd_code : UPDATE_FIRMWARE。
            // cmd_param : {"firmware_file_name":"<1>","firmware_bin_data":"BIN_1"}

            string sFileTitle = Path.GetFileName(sUpdateFirmwareFile);
            string sCmdParam = "{\"firmware_file_name\":\"" + sFileTitle + "\",\"firmware_bin_data\":\"BIN_1\"}";
            SetJsonBlock(sCmdParam, out abytSendBuff);
            AppendBinaryBlock(ref abytSendBuff, bytFirmwareBin);

            return true;
        }

        public bool LoadScreen(
            string asDevId,
            string asScreenType,
            string asFilePath,
            ref byte[] abytSendBuff)
        {
            const string csFuncName = "LoadScreen";

            PrintDebugMsg(csFuncName, "1 - ");

            // 파라메터자료를 초기화한다.
            abytSendBuff = new byte[0];

            FileStream fs = new FileStream(asFilePath, FileMode.Open, FileAccess.Read);

            if (fs.Length == 0)
            {
                fs.Close();
                return false;
            }
            byte[] bytFirmwareBin = new byte[fs.Length];
            fs.Read(bytFirmwareBin, 0, (int)fs.Length);
            fs.Close();

            // cmd_code : UPDATE_FIRMWARE。
            // cmd_param : {"firmware_file_type":"<0>","firmware_file_name":"<1>","firmware_bin_data":"BIN_1"}

            string sFileTitle = Path.GetFileName(asFilePath);
            string sCmdParam = "{\"firmware_file_type\":\"" + asScreenType + "\",\"firmware_file_name\":\"" + sFileTitle + "\",\"firmware_bin_data\":\"BIN_1\"}";
            SetJsonBlock(sCmdParam, out abytSendBuff);
            AppendBinaryBlock(ref abytSendBuff, bytFirmwareBin);

            return true;
        }

        // functions exported by FpDataConv.dll
        public const int FPCONV_ERR_NONE = 0;

        [DllImport("FpDataConv.dll", CharSet = CharSet.Auto)]
        static extern void FPCONV_Init();
        
        [DllImport("FpDataConv.dll", CharSet = CharSet.Auto)]
        static extern int FPCONV_GetFpDataValidity(byte [] abytFpData);
        
        [DllImport("FpDataConv.dll", CharSet = CharSet.Auto)]
        static extern int FPCONV_GetFpDataVersionAndSize(byte [] abytFpData, ref int anFpDataVer, ref int anFpDataSize);

        [DllImport("FpDataConv.dll", CharSet = CharSet.Auto)]
        static extern int FPCONV_GetFpDataSize(int anFpDataVer, ref int anFpDataSize);

        [DllImport("FpDataConv.dll", CharSet = CharSet.Auto)]
        static extern int FPCONV_Convert(int anSrcFpDataVer, byte[] abytSrcFpData, int anDstFpDataVer, byte[] abytDstFpData);


        public bool ConvertFpDataForDestFK(byte[] abytSrcFpData, int anDstFpDataVer, out byte[] abytDstFpData)
        {
            int nSrcFpDataVer = 0;
            int nSrcFpDataSize = 0;
            int nDstFpDataSize = 0;

            abytDstFpData = new byte[0];

            if (abytSrcFpData.Length < 1)
                return false;

            FPCONV_Init();
            if (FPCONV_GetFpDataVersionAndSize(abytSrcFpData, ref nSrcFpDataVer, ref nSrcFpDataSize) != FPCONV_ERR_NONE)
                return false;
            PrintDebugMsg(" ", "dataSrcVer =" + nSrcFpDataVer + " dataDestVer =" + anDstFpDataVer);
            if ((nSrcFpDataVer == 0) || (nSrcFpDataSize == 0))
                return false;
            if (nSrcFpDataVer == anDstFpDataVer || anDstFpDataVer == 0)////지문이 필요없는 기대들에는 변환을 진행하지 않고 그냥 내려보낸다.
            {
                abytDstFpData = new byte[abytSrcFpData.Length];
                abytSrcFpData.CopyTo(abytDstFpData, 0);
                return true;
            }

            if (FPCONV_GetFpDataSize(anDstFpDataVer, ref nDstFpDataSize) != FPCONV_ERR_NONE)
                return false;

            abytDstFpData = new byte[nDstFpDataSize];
            if (FPCONV_Convert(nSrcFpDataVer, abytSrcFpData, anDstFpDataVer, abytDstFpData) != FPCONV_ERR_NONE)
            {
                abytDstFpData = new byte[0];
                return false;
            }

            return true;
        }


        //=============================================================================
        // 기대가 자기에 대해 발행된 조작자지령을 얻어갈때 호출되는 함수이다.
	    public void ReceiveCmd(
	        string asDevId,
	        out string asTransId,
	        out string asCmdCode,
            out string asCmdParam)
	    {
            const string csFuncName = "ReceiveCmd";

	        asResponseCode = "ERROR";
	        asTransId = "";
	        asCmdCode = "";
	        asCmdParam = "";

            try{
                if (m_db == null) m_db = new FKWebDB();
                m_db.GetMyCommand(asDevId, out asTransId, out asCmdCode, out asCmdParam);
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
            }
	    }
        //=============================================================================
        // 기대가 자기에 대해 발행된 조작자지령을 실행하기 위해 호출되는 함수이다.
        public void ProcessCommand(
            string asDevId,
            string asCmdCode,
            string asCmdParam,
            out byte[] abytSendBuff,
            out string asResponseCode)
        {
            const string csFuncName = "ProcessCommand";
            abytSendBuff = new byte[0];


            asResponseCode = "OK"; 
            if (asCmdCode == "SET_TIME")
            {
                // 만일 "기대시간동기"지령이 발행된것이 발견되면 동기시킬 시간을 써버의 시간으로 설정한다.
                LoadCurrentTime(ref abytSendBuff);
            }
            if (asCmdCode == "UPDATE_FIRMWARE")
            {
                PrintDebugMsg(csFuncName, asCmdParam);
                JObject jobjLogInfo = JObject.Parse(asCmdParam);
                string firmware_file_type = "firmware";
                if (jobjLogInfo["firmware_file_type"] != null)
                    firmware_file_type = jobjLogInfo["firmware_file_type"].ToString();

                if (firmware_file_type == "firmware")
                {
                    // 만일 "펌웨어갱신"지령이 발행된것이 발견되면 지적된 등록부에서 가장 최신판본의 펌웨어를 선택하여 파라메터를 만든다.
                    if (LoadFirmware(asDevId, ref abytSendBuff) == false)
                    {
                        asResponseCode = "ERROR_GET_PARAM";
                    }
                    return;
                }
                else
                {
                    if (asCmdParam.Contains("firmware_file_name") == true)
                    {
                        if (jobjLogInfo["firmware_file_name"] != null)
                        {
                            string firmware_file_path = jobjLogInfo["firmware_file_name"].ToString();
                            if (LoadScreen(asDevId, firmware_file_type, firmware_file_path, ref abytSendBuff) == false)
                            {
                                asResponseCode = "ERROR_GET_PARAM";
                            }
                            return;
                        }
                    }
                }
            }

            if (asCmdCode == "SET_ENROLL_DATA")
            {
                JObject jobjLogInfo = JObject.Parse(asCmdParam);
                string user_id = jobjLogInfo["user_id"].ToString();
                int backup_number = Convert.ToInt32(jobjLogInfo["backup_number"].ToString());

                if (LoadEnrollData(asDevId, user_id, backup_number, ref abytSendBuff) == false)
                {
                    asResponseCode = "ERROR_GET_PARAM";
                }
                return;
            }
            if (asCmdCode == "SET_USER_INFO")
            {
                JObject jobjUserInfo = JObject.Parse(asCmdParam);
                string user_id = jobjUserInfo["user_id"].ToString();
                // 만일 지령파라메터에 [dev_id]항목이 있으면 [ 사 용 자 자 료 복 사 ]에 해당하며 
                //그 의미는 설정할 사용자자료를 현재 기대가 아니라 dev_id기대로부터 읽어들인다는뜻이다. 2019.7.31 by KKS
                string dev_id = asDevId;
                if (asCmdParam.Contains("dev_id") == true) {
                    dev_id = jobjUserInfo["dev_id"].ToString();
                }
                // 만일 지령파라메터에 [photofile]항목이 있으면 [ 사 진 파 일 불 러 들 이 기 ]에 해당하며 
                //그 의미는 설정할 사용자자료를 현재 기대가 아니라 사진파일로부터 읽어들인다는뜻이다. 2019.7.31 by KKS
                bool ret = false;
                if (asCmdParam.Contains("photofile") == true){
                    string photofile = jobjUserInfo["photofile"].ToString();
                    ret = LoadUserInfoFromPhoto(user_id, photofile, ref abytSendBuff);
                }else{
                    ret = LoadUserInfo(dev_id, user_id, ref abytSendBuff);
                }
                if ( ret == false)
                {
                    asResponseCode = "ERROR_GET_PARAM";
                }
                return;
            }

            abytSendBuff = new byte[0];
            if (asCmdParam.Length > 0) { 
                if ( SetJsonBlock(asCmdParam, out abytSendBuff) == false)
                    asResponseCode = "ERROR_GET_PARAM";
            }

        }
        public bool SaveRTLog(
           string asDevId,
           byte[] abytRecvBuff)
        {
            const string csFuncName = "SaveRTLog";

            string sJson, sMsg;
            byte[] bytLogImage = new byte[0];
            sJson = GetJsonBlock(abytRecvBuff);
            if (sJson.Length == 0)
                return false;
            sMsg = "";

            try
            {
                JObject jobjLogInfo = JObject.Parse(sJson);

                string sUserId = jobjLogInfo["user_id"].ToString();
                string sIoMode = jobjLogInfo["io_mode"].ToString();
                string sVerifyMode = jobjLogInfo["verify_mode"].ToString();
                string sIoTime = jobjLogInfo["io_time"].ToString();
                string sTemperature = "0";
                if (jobjLogInfo["temperature"] != null) sTemperature = jobjLogInfo["temperature"].ToString();
                sMsg = sJson + " " + sIoMode + " " + sVerifyMode + " " + sTemperature;

                PrintDebugMsg(csFuncName, "  ------ sIoMode" + sIoMode);
                sIoTime = FKWebTools.ConvertFKTimeToNormalTimeString(sIoTime);

                sFKDataLib = jobjLogInfo["fk_bin_data_lib"].ToString();
                if (sFKDataLib == null) GetDeviceVersion(asDevId);
                PrintDebugMsg(csFuncName, "  ------ sIoMode" + sFKDataLib);

                // 확인방식, 출입방식을 변환한다.
                if (sFKDataLib.ToUpper() == "FKDATAHS101")
                {
                    PrintDebugMsg(csFuncName, "  ---   --- sIoMode" + sIoMode);
                    if (sIoMode != null) sIoMode = FKDataHS101.GLog.GetInOutModeString(Convert.ToInt32(sIoMode));
                    PrintDebugMsg(csFuncName, "  ---   --- sIoMode" + sVerifyMode);
                    if (sVerifyMode != null) sVerifyMode = FKDataHS101.GLog.GetVerifyModeString(Convert.ToInt32(sVerifyMode));
                    PrintDebugMsg(csFuncName, "  ---   --- sIoMode" + sTemperature);
                    if (sTemperature != null) sTemperature = FKDataHS101.GLog.GetTemperatureString(Convert.ToInt32(sTemperature));
                }

                else if (sFKDataLib.ToUpper() == "FKDATAHS100")
                {
                    if (sIoMode != null) sIoMode = FKDataHS100.GLog.GetInOutModeString(Convert.ToInt32(sIoMode));
                    if (sVerifyMode != null) sVerifyMode = FKDataHS100.GLog.GetVerifyModeString(Convert.ToInt32(sVerifyMode));
                }

                if (jobjLogInfo["log_image"] != null)
                {
                    string sLogImage = jobjLogInfo["log_image"].ToString();
                    if (sLogImage == "BIN_1")
                    {
                        bytLogImage = GetBinaryBlock(1, abytRecvBuff);
                    }
                }

                m_db.SetGLog(asDevId, sUserId, sVerifyMode, sIoMode, sIoTime, sTemperature, bytLogImage);
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString() + sJson);
                return false;
            }

            return true;
        }
        public bool SaveGLog(
           string asDevId,           
           byte[] abytRecvBuff)
        {
            const string csFuncName = "SaveGLog";

            // 결과자료를 해석한다.
            string sJson;
            byte[] bytLogList;
            sJson = GetJsonBlock(abytRecvBuff);
            bytLogList = GetBinaryBlock(1, abytRecvBuff);
            if (sJson.Length == 0)
                return false;

            PrintDebugMsg(csFuncName, "4");
            int cntLog, sizeOneLog;
            try
            {
                JObject jobjLogInfo = JObject.Parse(sJson);
                cntLog = Convert.ToInt32(jobjLogInfo["log_count"].ToString());
                sizeOneLog = Convert.ToInt32(jobjLogInfo["one_log_size"].ToString());
                if (bytLogList.Length < cntLog*sizeOneLog)
                    return false;

                PrintDebugMsg(csFuncName, "5 log count="+Convert.ToString(cntLog));
                //if (sizeOneLog != 12 && sizeOneLog != 24)
                if (sFKDataLib == null) GetDeviceVersion(asDevId);
                PrintDebugMsg(csFuncName, "6 - " + sFKDataLib);
                if (sFKDataLib.ToUpper() == "FKDATAHS100")
                {
                    if (!FKDataHS100.GLog.IsValidLength(sizeOneLog))
                        return false;
                }
                else if (sFKDataLib.ToUpper() == "FKDATAHS101")
                {
                    if (!FKDataHS101.GLog.IsValidLength(sizeOneLog))
                        return false;
                }else
                    return false;
                PrintDebugMsg(csFuncName, "7 - " + sFKDataLib);

                // 이전에 해당 trans_id, dev_id에 대하여 얻은 로그자료들이 있으면 모두 삭제한다.
                if (m_db == null) m_db = new FKWebDB();
                PrintDebugMsg(csFuncName, "7 - 1" + sFKDataLib);
                m_db.ClearGLog(asDevId);
                //GetDeviceVersion(asDevId);
                PrintDebugMsg(csFuncName, "7 - 2" + sFKDataLib);

                string sUserId = "";
                string sIoMode = "";
                string sVerifyMode = "";
                string sIoTime = "";
                string sTemperature = "";
                int k;
                byte[] bytOneLog = new byte[sizeOneLog];
                byte[] abytLogImage = new byte[0];
                for (k = 0; k < cntLog; k++)
                {
                    PrintDebugMsg(csFuncName, "7 - 3" + sFKDataLib);
                    Buffer.BlockCopy(
                        bytLogList, k * sizeOneLog,
                        bytOneLog, 0,
                        sizeOneLog);
                    PrintDebugMsg(csFuncName, "7 - 4" + sFKDataLib);

                    if (sFKDataLib.ToUpper() == "FKDATAHS101")
                    {
                        PrintDebugMsg(csFuncName, "7 - 5" + sFKDataLib);

                        string ExtUserId = System.Text.Encoding.Default.GetString(bytOneLog, 0, FKDataHS101.GLog.STRUCT_SIZE_EXTUSERID);
                        PrintDebugMsg(csFuncName, "7 - 6 ExtUserId" + ExtUserId);
                        int UserId = Convert.ToInt32(ExtUserId);
                        PrintDebugMsg(csFuncName, "7 - 7 UserId" + UserId);




                        FKDataHS101.GLog glog = new FKDataHS101.GLog(bytOneLog);
                        PrintDebugMsg(csFuncName, "8 - " + sFKDataLib);
                        if (glog.ExtUserId.Length > 0) // if  USE_EXT_ID
                            sUserId = glog.ExtUserId;
                        else
                            sUserId = Convert.ToString(glog.UserId);
                        PrintDebugMsg(csFuncName, "6 - " + sFKDataLib);
                        sIoMode = FKDataHS101.GLog.GetInOutModeString(glog.IoMode);
                        PrintDebugMsg(csFuncName, "sIoMode - " + sIoMode);
                        sVerifyMode = FKDataHS101.GLog.GetVerifyModeString((int)glog.VerifyMode);
                        PrintDebugMsg(csFuncName, "sVerifyMode - " + sVerifyMode);
                        sIoTime = glog.GetIoTimeString();
                        PrintDebugMsg(csFuncName, "sIoTime - " + sIoTime);
                        sTemperature = FKDataHS101.GLog.GetTemperatureString((int)glog.Temperature);
                        PrintDebugMsg(csFuncName, "sTemperature - " + sTemperature);

                        m_db.SetGLog(asDevId, sUserId, sVerifyMode, sIoMode, sIoTime, sTemperature, abytLogImage);
                        PrintDebugMsg(csFuncName, " m_db.SetGLog(  " + asDevId + ", " +sUserId + ", " +sVerifyMode + ", " +sIoMode + ", " +sIoTime + ", " +sTemperature + ", LogImage)");
                        continue;
                    }
                    
                    if (sFKDataLib.ToUpper() == "FKDATAHS100"){
                        FKDataHS100.GLog glog = new FKDataHS100.GLog(bytOneLog);
                        sUserId = Convert.ToString(glog.UserId);
                        sIoMode = FKDataHS100.GLog.GetInOutModeString(glog.IoMode);
                        sVerifyMode = FKDataHS100.GLog.GetVerifyModeString(glog.VerifyMode);
                        sIoTime = glog.GetIoTimeString();
                        //sTemperature = "";

                        m_db.SetGLog(asDevId, sUserId, sVerifyMode, sIoMode, sIoTime, sTemperature, abytLogImage);
                        continue;
                    }

                    PrintDebugMsg(csFuncName, "error - sFKDataLib = " + sFKDataLib);
                    return false;
                }
            }
            catch(Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
                return false;
            }
            PrintDebugMsg(csFuncName, "8");
            return true;            
        }
        public bool SaveRTBarcode(
          string asDevId,
          byte[] abytRecvBuff)
        {
            const string csFuncName = "SaveRTBarcode";

            string sJson;
            byte[] bytLogImage = new byte[0];
            sJson = GetJsonBlock(abytRecvBuff);
            if (sJson.Length == 0)
                return false;

            try
            {
                JObject jobjLogInfo = JObject.Parse(sJson);


                string sIoTime = jobjLogInfo["scantime"].ToString();
 
                sIoTime = FKWebTools.ConvertFKTimeToNormalTimeString(sIoTime);


                if (jobjLogInfo["barcode"] != null)
                {
                    string sLogImage = jobjLogInfo["barcode"].ToString();
                    if (sLogImage == "BIN_1")
                    {
                        bytLogImage = GetBinaryBlock(1, abytRecvBuff);
                    }
                }

                m_db.SetBarcode(asDevId, sIoTime, bytLogImage);
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString() + sJson);
                return false;
            }

            return true;
        }
        public bool SaveRTOperation(
          string asDevId,
          byte[] abytRecvBuff)
        {
            const string csFuncName = "SaveRTOperation";

            string sJson;
            byte[] bytLogImage = new byte[0];
            sJson = GetJsonBlock(abytRecvBuff);
            if (sJson.Length == 0)
                return false;

            try
            {
                JObject jobjLogInfo = JObject.Parse(sJson);


                //string sDevice = jobjLogInfo["device_id"].ToString();
                string sUser = jobjLogInfo["user_id"].ToString();
                string sCode = jobjLogInfo["oper_code"].ToString();
                string sTime = jobjLogInfo["oper_time"].ToString();
                string sDetail = jobjLogInfo["oper_detail"].ToString();

                sTime = FKWebTools.ConvertFKTimeToNormalTimeString(sTime);


                m_db.SetOperation(asDevId, sUser, sCode, sTime, sDetail);
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString() + sJson);
                return false;
            }

            return true;
        }

        public bool SaveEnrollData(
           string asDevId,
           byte[] abytRecvBuff)
        {
            const string csFuncName = "SaveEnrollData";

            PrintDebugMsg(csFuncName, "3 - 1 - ");
            string sCmdParam = GetJsonBlock(abytRecvBuff);

            string user_id;
            int backup_number;
            try
            {
                JObject jobjCmdParam = JObject.Parse(sCmdParam);
                user_id = jobjCmdParam["user_id"].ToString();
                backup_number = Convert.ToInt32(jobjCmdParam["backup_number"].ToString());

                byte[] enroll_data = new byte[0];
                enroll_data = GetBinaryBlock(1, abytRecvBuff);
                if (m_db == null) m_db = new FKWebDB();
                m_db.SetEnrollData(asDevId, user_id, backup_number, enroll_data);
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
                return false;
            }
            return true;
        }
        public bool LoadEnrollData(
            string asDevId,
            string asUserId,
            int BackupNumber,
            ref byte[] abytSendBuff)
        {
            const string csFuncName = "LoadEnrollData";

            string vsJson = "{";
            vsJson += "\"user_id\":\"" + asUserId + "\",";
            vsJson += "\"backup_number\":\"" + BackupNumber + "\",";
            vsJson += "\"enroll_data\":\"BIN_1\"}";

            byte[] bytFpData = new byte[0];
            if (m_db == null) m_db = new FKWebDB();
            m_db.GetEnrollData(asDevId, asUserId, BackupNumber, out bytFpData);
            if (DstFpDataVer == null) GetDeviceVersion(asDevId);

            if (BackupNumber < 10)
            {
                byte[] bytFpDataConv;
                if (!ConvertFpDataForDestFK(bytFpData, DstFpDataVer, out bytFpDataConv))
                {
                    return false;
                }
                bytFpData = new byte[bytFpDataConv.Length];
                Buffer.BlockCopy(bytFpDataConv, 0, bytFpData, 0, bytFpDataConv.Length);
            }

            SetJsonBlock(vsJson, out abytSendBuff);
            AppendBinaryBlock(ref abytSendBuff, bytFpData);

            return true;
        }


        //자료구조는 실시간전송RealtimeEnrollData시와 SET_USER_INFO/ GET_USER_INFO시가 같다. 2019.7.13 by KKS
        public bool SaveUserInfo(
           string asDevId,
           byte[] abytRecvBuff)
        {
            const string csFuncName = "SaveUserInfo";

            string sCmdParam = GetJsonBlock(abytRecvBuff);
            PrintDebugMsg(csFuncName, sCmdParam);

            List<EnrollData> listEnrollData = new List<EnrollData>();
            string user_id;
            string user_name;
            string user_privilege;
            string user_note;

            try
            {
                JObject jobjCmdParam = JObject.Parse(sCmdParam);
                // 지령파라메터의 각 필드의 값들을 얻어낸다.
                user_id = jobjCmdParam["user_id"].ToString();
                if (m_db == null) m_db = new FKWebDB();
                m_db.DeleteUser(asDevId, user_id);

                user_name = jobjCmdParam["user_name"].ToString();
                user_privilege = jobjCmdParam["user_privilege"].ToString();
                user_note = "";
                if (sCmdParam.Contains("user_pass")) 
                    user_note = "{\"user_pass\":\"" + jobjCmdParam["user_pass"].ToString() + "\"}";
                m_db.SetUser(asDevId, user_id, user_name, user_privilege, user_note);
                PrintDebugMsg(csFuncName, "m_db.SetUser(" + asDevId + ", " + user_id + ", " + user_name + ", " + user_privilege + ", " + user_note + ")");

                // 지령파라메터에 사용자의 등록화상자료가 포함되여 있는가 본다. 있으면 등록화상자료를 파라메터자료로 부터 얻어낸다.
                if (jobjCmdParam.SelectToken("user_photo") != null)
                {
                    string sTemp;
                    sTemp = jobjCmdParam["user_photo"].ToString();
                    int m = Convert.ToInt32(sTemp.Substring(4, sTemp.Length - 4));
                    if (m >= 1)
                    {
                        byte[] user_photo = new byte[0];
                        user_photo = GetBinaryBlock(m, abytRecvBuff);
                        m_db.SetEnrollData(asDevId, user_id, 50, user_photo);
                    }
                }

                //enroll_data_array항목의 값이 null, [] 등 길이가 10보다 작으면 세부항목이 없다고 보고 탈퇴한다. 
                //enroll_data_array에서 한개 세부항목 최소길이는 41 byte이다. 실례: {"backup_number":30,"enroll_data":"BIN_2"}
                if (jobjCmdParam["enroll_data_array"].ToString().Length < 10) return true; 

                // 지령파라메터에 포함되여 있는 등록자료들을 하나씩 꺼내면서 등록자료가 지문자료에 해당한 것이면 목적기대에 맞게 변환을 진행한다.
                JArray jarrEnrollData = (JArray)jobjCmdParam["enroll_data_array"];
                EnrollData ed;
                JObject jobjOneED;
                for (int k = 0; k < jarrEnrollData.Count; k++)
                {
                    string sTemp;
                    jobjOneED = (JObject)jarrEnrollData[k];
                    ed = new EnrollData();
                    ed.BackupNumber = Convert.ToInt32(jobjOneED["backup_number"]);

                    sTemp = jobjOneED["enroll_data"].ToString();
                    if (sTemp.Length < 5) continue;

                    int m = Convert.ToInt32(sTemp.Substring(4, sTemp.Length - 4));
                    if (m < 1) continue;

                    ed.bytData = GetBinaryBlock(m, abytRecvBuff);

                    m_db.SetEnrollData(asDevId, user_id, ed.BackupNumber, ed.bytData);
                }
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
                return false;
            }
            return true;
        }
        public bool LoadUserInfo(
           string asDevId,
           string user_id,
           ref byte[] abytSendBuff)
        {
            const string csFuncName = "LoadUserInfo";

            string sCmdParam = "{";
            sCmdParam += "\"user_id\":\"" + user_id + "\",";

            string user_name;
            string user_privilege;
            string user_note;
            if (m_db == null) m_db = new FKWebDB();
            m_db.GetUser(asDevId, user_id, out user_name, out user_privilege, out user_note);
            sCmdParam += "\"user_name\":\"" + user_name + "\",";
            sCmdParam += "\"user_privilege\":\"" + user_privilege + "\",";
            if (user_note.Length > 0) {
                JObject jobjUserNote = JObject.Parse(user_note);
                if (jobjUserNote.SelectToken("user_pass") != null) 
                    sCmdParam += "\"user_pass\":\"" + jobjUserNote["user_pass"].ToString() + "\",";
            }

            List<EnrollData> listEnrollData = new List<EnrollData>();
            bool hasPhoto = false;
            m_db.GetEnrollDataList(asDevId, user_id, out listEnrollData, out hasPhoto);

            byte[] abytBuffer = new byte[0];
            byte[] abytPhoto = new byte[0];
            int block_num = 1;
            if (hasPhoto == true)
            {
                sCmdParam += "\"user_photo\":\"BIN_" + block_num + "\",";
                block_num++;
            }
            sCmdParam += "\"enroll_data_array\":[";

            foreach (EnrollData ed in listEnrollData)
            {
                if (ed.BackupNumber == 50)
                {
                    abytPhoto = ed.bytData;
                    continue;
                }
                sCmdParam += "{\"backup_number\":" + ed.BackupNumber + ",\"enroll_data\":\"BIN_" + block_num + "\"},";

                AppendBinaryBlock(ref abytBuffer, ed.bytData);
                block_num++;
            }
            sCmdParam += "]}";
            sCmdParam = sCmdParam.Replace(",]}", "]}");

            byte[] abytBuffer0 = new byte[0];
            SetJsonBlock(sCmdParam, out abytBuffer0);
            if (hasPhoto == true) AppendBinaryBlock(ref abytBuffer0, abytPhoto);

            int len_dest = abytBuffer0.Length + abytBuffer.Length;
            abytSendBuff = new byte[len_dest];
            Buffer.BlockCopy(abytBuffer0, 0, abytSendBuff, 0, abytBuffer0.Length);
            Buffer.BlockCopy(abytBuffer, 0, abytSendBuff, abytBuffer0.Length, abytBuffer.Length);

            return true;
        }
        public bool LoadUserInfoFromPhoto(
           string user_id,
           string photofile,
           ref byte[] abytSendBuff)
        {
            const string csFuncName = "LoadUserInfoFromPhoto";

            if (user_id == null) return false;
            if (user_id.Length == 0) return false;
            if (photofile == null) return false;
            if (photofile.Length == 0) return false;
            if (photofile.ToLower().Contains(".jpg") == false) return false;
 
            string sCmdParam = "{";
            sCmdParam += "\"user_id\":\"" + user_id + "\",";

            
            string user_name = Path.GetFileName(photofile);
            user_name = user_name.Substring(0, user_name.IndexOf('.'));
            string user_privilege = "USER";

            sCmdParam += "\"user_name\":\"" + user_name + "\",";
            sCmdParam += "\"user_privilege\":\"" + user_privilege + "\",";



            FileStream fs = new FileStream(photofile, FileMode.Open, FileAccess.Read);
            int filelen = (int)fs.Length;
            byte[] abytPhoto = new byte[filelen];
            fs.Read(abytPhoto, 0, filelen);
            fs.Close();

            if (filelen == 0) return false;

            //사진자료를 user_photo항목이 아니라 backup_number=50으로 내려보낸다. 2019.7.31 by KKS
            //sCmdParam += "\"user_photo\":\"BIN_1\",";

            sCmdParam += "\"enroll_data_array\":[";
            sCmdParam += "{\"backup_number\":" + FKWebDB.BACKUP_USER_PHOTO + ",\"enroll_data\":\"BIN_1\"}";
            sCmdParam += "]}";

            byte[] abytBuffer0 = new byte[0];
            SetJsonBlock(sCmdParam, out abytBuffer0);
            AppendBinaryBlock(ref abytBuffer0, abytPhoto);

            int len_dest = abytBuffer0.Length;
            abytSendBuff = new byte[len_dest];
            Buffer.BlockCopy(abytBuffer0, 0, abytSendBuff, 0, abytBuffer0.Length);

            return true;
        }
        public bool SaveUserIdList(
           string asDevId,
           byte[] abytRecvBuff)
        {
            const string csFuncName = "SaveUserIdList";

            // 결과자료를 해석한다.
            string sJson;
            byte[] bytUserIdList;
            sJson = GetJsonBlock(abytRecvBuff);
            bytUserIdList = GetBinaryBlock(1, abytRecvBuff);
            if (sJson.Length == 0) return false;
            PrintDebugMsg(csFuncName, sJson);

            int cntUserId, sizeOneUserId;
            try
            {
                JObject jobjLogInfo = JObject.Parse(sJson);
                cntUserId = Convert.ToInt32(jobjLogInfo["user_id_count"].ToString());
                sizeOneUserId = Convert.ToInt32(jobjLogInfo["one_user_id_size"].ToString());
                if (bytUserIdList.Length < cntUserId * sizeOneUserId)
                    return false;
                //if (sizeOneUserId != 8)
                //    return false;
                if (sFKDataLib == null) GetDeviceVersion(asDevId);
                PrintDebugMsg(csFuncName, "user_id_count = " + cntUserId);
                if (sFKDataLib.ToUpper() == "FKDATAHS100")
                {
                    if (!FKDataHS100.UserIdInfo.IsValidLength(sizeOneUserId))
                        return false;
                }
                else if (sFKDataLib.ToUpper() == "FKDATAHS101")
                {
                    if (!FKDataHS101.UserIdInfo.IsValidLength(sizeOneUserId))
                        return false;
                }
                else
                    return false;

                if (m_db == null) m_db = new FKWebDB();
                //m_db.ClearUser(asDevId);

                string sUserId = "";
                int BackupNumber = -1;
                int k;
                byte[] bytOneUserId = new byte[sizeOneUserId];
                byte[] bytEnrolledFlag;

                List<string> listUserID = new List<string>();
                for (k = 0; k < cntUserId; k++)
                {
                    Buffer.BlockCopy(
                        bytUserIdList, k * sizeOneUserId,
                        bytOneUserId, 0,
                        sizeOneUserId);
/*
                    for (int jj = 0; jj < bytOneUserId.Length; jj++)
                    {
                        PrintDebugMsg(csFuncName, "bytOneUserId[" + jj + "]=" + bytOneUserId[jj]);
                    }
*/
                    PrintDebugMsg(csFuncName, sFKDataLib);
                    if (sFKDataLib.ToUpper() == "FKDATAHS101")
                    {
                        //int nEnrollDataCount = 0;
                        FKDataHS101.UserIdInfo usrid = new FKDataHS101.UserIdInfo(bytOneUserId);
                        if (usrid.ExtUserId.Length > 0)// if  USE_EXT_ID
                            sUserId = usrid.ExtUserId;
                        else
                            sUserId = Convert.ToString(usrid.UserId);
                        PrintDebugMsg(csFuncName, "UserId : " + sUserId);


                        if (!listUserID.Contains(sUserId))
                        {
                            m_db.SetUser(asDevId, sUserId, "", "", "");
                            listUserID.Add(sUserId);
                        }

                        //usrid.GetBackupNumberEnrolledFlag(out bytEnrolledFlag);
                        ////PrintDebugMsg(csFuncName, "6 - " + FKWebTools.GetHexString(bytEnrolledFlag));
                        //for (int bkn = 0; bkn < bytEnrolledFlag.Length; bkn++)
                        //{
                        //    if (bytEnrolledFlag[bkn] == 1)
                        //    {
                        //        nEnrollDataCount++;
                        //        m_db.SetUserID( asDevId, sUserId, bkn);
                        //        PrintDebugMsg(csFuncName, asDevId + ", " + sUserId + ", " + bkn);
                        //    }
                        //}
                        //if (nEnrollDataCount == 0)
                        //{
                        //    m_db.SetUserID( asDevId, sUserId, -1);
                        //}
                        PrintDebugMsg(csFuncName, "FKDATAHS101 : " + sUserId);
                        continue;
                    } 

                    if (sFKDataLib.ToUpper() == "FKDATAHS100")
                    {
                        FKDataHS100.UserIdInfo usrid = new FKDataHS100.UserIdInfo(bytOneUserId);
                        sUserId = Convert.ToString(usrid.UserId);

                        if (!listUserID.Contains(sUserId))
                        {
                            m_db.SetUser(asDevId, sUserId, "", "", "");
                            listUserID.Add(sUserId);
                        }

                        //BackupNumber = (int)usrid.BackupNumber;
                        //m_db.SetUserID(asDevId, sUserId, BackupNumber);
                        PrintDebugMsg(csFuncName, "FKDATAHS100 : " + sUserId);
                        continue;
                    }

                    PrintDebugMsg(csFuncName, "unknown sFKDataLib : " + sFKDataLib);
                }
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
                return false;
            }

            return true;
        }

        public bool SaveDeviceStatus(
           string asDevId,
           byte[] abytRecvBuff)
        {
            const string csFuncName = "SaveDeviceStatus";
            string sJson, sStatus;
            sJson = GetJsonBlock(abytRecvBuff);

            try
            {
                JObject jobjDeviceStatus = JObject.Parse(sJson);
                //sStatus = jobjDeviceStatus.ToString(Newtonsoft.Json.Formatting.None);
                if (m_db == null) m_db = new FKWebDB();
                //m_db.SetDeviceStatus(asDevId, sStatus);
                m_db.SetDeviceStatus(asDevId, sJson);
            }
            catch (Exception ex)
            {
                PrintDebugMsg(csFuncName, ex.ToString());
                return false;
            }

            return true;
        }

        //===================================================================================
        // 기대가 조작자지령을 접수하고 올려보내는 결과를 받을때 호출되는 함수이다.
	    public void ProcessCmdResult(
	        string asTransId, 
	        string asDevId, 
	        string asReturnCode, 
	        byte[] abytRecvBuff,
	        out string asResponseCode)
	    {
	        const string csFuncName = "ProcessCmdResult";

            string command;
            string param;
            int state;
            string result = "";
            if (m_db == null) m_db = new FKWebDB();
            m_db.GetCommand(asTransId, out command, out param, out state, out result);
            PrintDebugMsg(csFuncName, command);

            // 해당 지령이 '취소'되였으면 그에 대해 응답한다.
            if (state < 0) {
                asResponseCode = "ERROR_CANCELED";
                return;
            }

            asResponseCode = "OK";
            if (command == "GET_LOG_DATA")
            {
                if (SaveGLog(asDevId, abytRecvBuff) == false) {
                    asResponseCode = "ERROR_DB_SAVE_LOG";
                }
            }

            if (command == "GET_USER_ID_LIST") {
                if (SaveUserIdList(asDevId, abytRecvBuff) == false) {
                    asResponseCode = "ERROR_DB_SAVE_USER_ID_LIST";
                }
            }

            if (command == "GET_USER_INFO") {
                if (SaveUserInfo(asDevId, abytRecvBuff) == false) {
                    asResponseCode = "ERROR_DB_SAVE_USER_INFO";
                }
            }

            if (command == "GET_ENROLL_DATA")
            {
                if (SaveEnrollData(asDevId, abytRecvBuff) == false)
                {
                    asResponseCode = "ERROR_DB_SAVE_ENROLL_DATA";
                }
            }

            if (command == "GET_DEVICE_STATUS")
            {
                if (SaveDeviceStatus(asDevId, abytRecvBuff) == false)
                {
                    asResponseCode = "ERROR_DB_SAVE_DEVICE_STATUS";
                }
            }

            m_db.SetCmdResult(asDevId, asTransId, asReturnCode);
            PrintDebugMsg(csFuncName, asReturnCode);
            return;
	    }
	}
}

