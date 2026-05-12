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

namespace FKWeb
{
    public class FKWebTools
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Auto)]
        public static extern void OutputDebugString(string message);

        static public void PrintDebug(string astrFunction, string astrMsg)
        {
            int nThreadId = Thread.CurrentThread.ManagedThreadId;
            DateTime dtNow = DateTime.Now;
            String strOut = String.Format("{0:D2}:{1:D2}:{2:D2} Thrd={3:D}",
                    dtNow.Hour, dtNow.Minute, dtNow.Second, nThreadId);

            strOut = astrFunction + " - " + astrMsg + " - " + strOut;
            OutputDebugString(strOut);
        }

        static public bool IsEngOrDigit(char aChar)
        {
            if (Char.IsLower(aChar))
                return true;
            if (Char.IsUpper(aChar))
                return true;
            if (Char.IsDigit(aChar))
                return true;

            return false;
        }

        static public void ConcateByteArray(ref byte[] abytDest, byte[] abytSrc)
        {
            int len_dest = abytDest.Length + abytSrc.Length;

            if (abytSrc.Length == 0)
                return;

            byte[] bytTmp = new byte[len_dest];
            Buffer.BlockCopy(abytDest, 0, bytTmp, 0, abytDest.Length);
            Buffer.BlockCopy(abytSrc, 0, bytTmp, abytDest.Length, abytSrc.Length);
            abytDest = bytTmp;
        }

        static public bool IsValidEngDigitString(string astrVal, int anMaxLength)
        {
            if (String.IsNullOrEmpty(astrVal))
                return false;
            if ((astrVal.Length < 1) || (astrVal.Length > anMaxLength))
                return false;

            for (int k = 0; k < astrVal.Length; k++)
            {
                if (!IsEngOrDigit(astrVal[k]) && !astrVal[k].Equals('_'))
                    return false;
            }
            return true;
        }

        static public bool IsValidTimeString(string astrVal)
        {
            if (String.IsNullOrEmpty(astrVal))
                return false;

            DateTime datetime;
            try
            {
                if (!DateTime.TryParseExact(astrVal, "yyyy-MM-dd HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeLocal, out datetime))
                    return false;

                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        static public string TimeToString(DateTime aTimeVal, int mode)
        {
            string strRet;
            try
            {
                strRet = "" + aTimeVal.Year + "-" + aTimeVal.Month + "-" + aTimeVal.Day + " " +
                    aTimeVal.Hour + ":" + aTimeVal.Minute + ":" + aTimeVal.Second;
                if (mode == 1) strRet = "" + aTimeVal.Year + "-" + aTimeVal.Month + "-" + aTimeVal.Day + " 00:00:00";
                if (mode == 2) strRet = "" + aTimeVal.Year + "-" + aTimeVal.Month + "-" + aTimeVal.Day + " 23:59:59";

                return strRet;
            }
            catch (Exception)
            {
                return "1970-1-1 1:0:0";
            }
        }

        static public string GetFKTimeString14(DateTime aTimeVal)
        {
            try
            {
                string strDateTime;
                strDateTime = String.Format("{0:D4}{1:D2}{2:D2}{3:D2}{4:D2}{5:D2}",
                    aTimeVal.Year, aTimeVal.Month, aTimeVal.Day, aTimeVal.Hour, aTimeVal.Minute, aTimeVal.Second);

                return strDateTime;
            }
            catch (Exception)
            {
                return "19700101010000";
            }
        }

        static public string ConvertFKTimeToNormalTimeString(string astrFKTime14)
        {
            string strRet = "";

            if (astrFKTime14.Length != 14)
                return strRet;

            strRet = astrFKTime14.Substring(0, 4) + "-" +
                    astrFKTime14.Substring(4, 2) + "-" +
                    astrFKTime14.Substring(6, 2) + " " +
                    astrFKTime14.Substring(8, 2) + ":" +
                    astrFKTime14.Substring(10, 2) + ":" +
                    astrFKTime14.Substring(12, 2);

            return strRet;
        }

        static public string GetStringFromObject(object aObj)
        {
            try
            {
                return Convert.ToString(aObj);
            }
            catch (Exception)
            {
                return "";
            }
        }

        static public int GetIntFromObject(object aObj)
        {
            try
            {
                return Convert.ToInt32(aObj);
            }
            catch (Exception)
            {
                return 0;
            }
        }

        static public int CompareStringNoCase(string as1, string as2)
        {
            as1 = as1.ToLower();
            as2 = as2.ToLower();
            if (as1 == as2)
                return 0;
            else
                return 1;
        }

        static public string GetHexString(byte[] abytBuffer)
        {
            try
            {
                if (abytBuffer.Length == 0)
                    return "";

                string sHex = BitConverter.ToString(abytBuffer).Replace("-", string.Empty);
                return sHex;
            }
            catch (Exception)
            {
                return "";
            }
        }

        static public void SaveToFile(string fn, byte[] buff)
        {
            try
            {
                FileStream fs = new FileStream(fn, FileMode.OpenOrCreate, FileAccess.Write);
                fs.Write(buff, 0, buff.Length);
                fs.Close();
            }
            catch
            { }
        }
        static public void DeleteFile(string fn)
        {
            try
            {
                if (File.Exists(fn))
                {
                    File.Delete(fn);
                }
            }
            catch
            { }
        }
        static public bool IsFile(string fn)
        {
            return (File.Exists(fn));
        }

        static public void CopyFile(string srcfn, string dscfn)
        {
            try
            {
                if (File.Exists(srcfn))
                {
                    File.Copy(srcfn, dscfn);
                }
            }
            catch
            { }
        }

        static public long FileSize(string fn)
        {
            FileInfo t = new FileInfo(fn);//获取文件
            return t.Length;
        }
    }

}
