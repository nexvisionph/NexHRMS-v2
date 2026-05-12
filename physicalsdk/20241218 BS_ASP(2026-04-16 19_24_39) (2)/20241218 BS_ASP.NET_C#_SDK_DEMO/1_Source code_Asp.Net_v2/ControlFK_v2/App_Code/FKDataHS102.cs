using System;
using System.Runtime.InteropServices;
using System.Collections.Specialized;
//using FKWeb;
namespace FKDataHS102
{

    //{ 다음의 2개의 구조체는 하오쑨 4775 리눅스얼굴기대에서 리용하는 구조체들이다.
    /*
    typedef struct tagGLOG_DATA_CIF13
    {
            unsigned char		 UserID[USER_ID_LEN];
	        unsigned char        DataVer;
            unsigned char		 Reserved[2];
	        unsigned char        Second;	
	        // 8 byte
	        unsigned long        Valid : 2;
            unsigned long        Year : 10;  // Real Year-1900
            unsigned long        Month : 4;	
	        unsigned long        Day : 5;
            unsigned long        Hour : 5;
            unsigned long        Minute : 6;
	        // 12 byte	
	
	        unsigned long       IoMode	; //FlagResult
	        unsigned long		VerifyMode;
    } GLOG_DATA_CIF13;  // size = 32 byte

    typedef struct tagUSER_ID_CIF13 {
	    unsigned char UserID[USER_ID_LEN];			// 0, 15
	    unsigned char Privilege;		// 16, 1
	    unsigned char Enabled;			// 17, 2
	    unsigned short PasswordFlag :1;	// 6, 2
	    unsigned short CardFlag :1;		// 6, 2
	    unsigned short FaceFlag :1;		// 6, 2
	    unsigned short FpCount :4;		// 6, 2
	    unsigned short VeinCount :6;	// 6, 2
	    unsigned short Reseved :3;		// 6, 2
    } USER_ID_CIF13;  // size = 20 byte

    */
    //}

    public class GLog
    {

        public const Int32 STRUCT_SIZE = 32;        // sizeof(GLOG_DATA_CIF13)
        public const Int32 USER_ID_LEN = 16;

        public enum enumVerifyKind
        {
            VK_NONE = 0,
            VK_FP = 1,
            VK_PASS = 2,
            VK_CARD = 3,
            VK_FACE = 4,
            VK_VEIN = 5,
            VK_IRIS = 6,
        }

        public enum enumGLogDoorMode
        {

            LOG_CLOSE_DOOR = 1,                // Door Close
            LOG_OPEN_HAND = 2,                 // Hand Open
            LOG_PROG_OPEN = 3,                 // Open by PC
            LOG_PROG_CLOSE = 4,                // Close by PC
            LOG_OPEN_IREGAL = 5,               // Illegal Open
            LOG_CLOSE_IREGAL = 6,              // Illegal Close
            LOG_OPEN_COVER = 7,                // Cover Open
            LOG_CLOSE_COVER = 8,               // Cover Close
            LOG_OPEN_DOOR = 9,                 // Door Open
            LOG_OPEN_DOOR_THREAT = 10,         // Door Open
        }

        [MarshalAs(UnmanagedType.ByValArray, SizeConst = USER_ID_LEN)]
        private byte[] UserId;

        public Int32 IoMode;
        public Int32 VerifyMode;

        public UInt16 Year
        {
            get { return (UInt16)tmLog[sctYear]; }
            set { tmLog[sctYear] = (UInt16)value; }
        }
        public byte Month
        {
            get { return (byte)tmLog[sctMonth]; }
            set { tmLog[sctMonth] = (byte)value; }
        }
        public byte Day
        {
            get { return (byte)tmLog[sctDay]; }
            set { tmLog[sctDay] = (byte)value; }
        }
        public byte Hour
        {
            get { return (byte)tmLog[sctHour]; }
            set { tmLog[sctHour] = (byte)value; }
        }
        public byte Minute
        {
            get { return (byte)tmLog[sctMinute]; }
            set { tmLog[sctMinute] = (byte)value; }
        }
        public byte Second;

        internal BitVector32 tmLog;
        internal static readonly BitVector32.Section sctValid = BitVector32.CreateSection((1 << 2) - 1);
        internal static readonly BitVector32.Section sctYear = BitVector32.CreateSection((1 << 10) - 1, sctValid);
        internal static readonly BitVector32.Section sctMonth = BitVector32.CreateSection((1 << 4) - 1, sctYear);
        internal static readonly BitVector32.Section sctDay = BitVector32.CreateSection((1 << 5) - 1, sctMonth);
        internal static readonly BitVector32.Section sctHour = BitVector32.CreateSection((1 << 5) - 1, sctDay);
        internal static readonly BitVector32.Section sctMinute = BitVector32.CreateSection((1 << 6) - 1, sctHour);

        public GLog()
        {
            UserId = new byte[USER_ID_LEN];
            IoMode = 0;
            VerifyMode = 0;
            Second = 0;
            tmLog = new BitVector32(0);
        }

        public GLog(byte[] abytLog)
        {

            if (abytLog.Length != STRUCT_SIZE)
                return;
            UserId = new byte[USER_ID_LEN];
            Buffer.BlockCopy(abytLog, 0,
                            UserId, 0,
                            USER_ID_LEN);

            Second = abytLog[19];

            tmLog = new BitVector32(BitConverter.ToInt32(abytLog, 20));

            IoMode = (Int32)BitConverter.ToInt32(abytLog, 24);

            VerifyMode = (Int32)BitConverter.ToInt32(abytLog, 28);
            
        }

        public bool IsValidIoTime()
        {
            if ((Year + 1900) < 1900 || (Year + 1900) > 3000)
                return false;
            if (Month < 1 || Month > 12)
                return false;
            if (Day < 1 || Day > 31)
                return false;
            if (Hour < 0 || Hour > 24)
                return false;
            if (Minute < 0 || Minute > 60)
                return false;
            if (Second < 0 || Second > 60)
                return false;

            return true;
        }

        public string GetIoTimeString()
        {
            if (!IsValidIoTime())
                return "1970-1-1 0:0:0";

            return (Convert.ToString(Year + 1900) + "-" +
                    Convert.ToString(Month) + "-" +
                    Convert.ToString(Day) + " " +
                    Convert.ToString(Hour) + ":" +
                    Convert.ToString(Minute) + ":" +
                    Convert.ToString(Second));
        }

        

        public string GetUserID()
        {
            return System.Text.Encoding.Default.GetString(UserId).TrimEnd('\0');
        }
        public void GetLogData(out byte[] abytLog)
        {
            abytLog = new byte[32];

            Buffer.BlockCopy(
                    UserId, 0,
                    abytLog, 0,
                    USER_ID_LEN);
            
            abytLog[19] = Second;

            Buffer.BlockCopy(
                    BitConverter.GetBytes((UInt32)tmLog.Data), 0,
                    abytLog, 20,
                    4);

            Buffer.BlockCopy(
                    BitConverter.GetBytes(IoMode), 0,
                    abytLog, 24,
                    4);
            Buffer.BlockCopy(
                    BitConverter.GetBytes(VerifyMode), 0,
                    abytLog, 28,
                    4);

        }

        private static void GetIoModeAndDoorMode(Int32 nIoMode, ref int vIoMode, ref int vDoorMode)
        {
            int vByteCount = 4;
            byte[] vbyteKind = new byte[vByteCount];
            byte[] vbyteDoorMode = new byte[vByteCount];
            vbyteKind = BitConverter.GetBytes(nIoMode);
            vIoMode = vbyteKind[3];
            for (int nIndex = 0; nIndex < 3; nIndex++)
            {
                vbyteDoorMode[nIndex] = vbyteKind[nIndex ];
            }
            vbyteDoorMode[3] = 0;
            vDoorMode = BitConverter.ToInt32(vbyteDoorMode, 0);


        }
        public static string GetInOutModeString(Int32 aIoMode)
        {
            string vstrTmp;
            int vIoMode = 0, vDoorMode = 0;
            GLog.GetIoModeAndDoorMode(aIoMode, ref vIoMode, ref vDoorMode);

            if (vDoorMode == 0)
                vstrTmp = "( " + vIoMode + " )";
            else
                vstrTmp = "( " + vIoMode + " ) &    ";
            switch (vDoorMode)
            {
                case (int)enumGLogDoorMode.LOG_CLOSE_DOOR:
                    vstrTmp += "Close Door"; break;
                case (int)enumGLogDoorMode.LOG_OPEN_HAND:
                    vstrTmp += "Hand Open"; break;
                case (int)enumGLogDoorMode.LOG_PROG_OPEN:
                    vstrTmp += "Prog Open"; break;
                case (int)enumGLogDoorMode.LOG_PROG_CLOSE:
                    vstrTmp += "Prog Close"; break;
                case (int)enumGLogDoorMode.LOG_OPEN_IREGAL:
                    vstrTmp += "Illegal Open"; break;
                case (int)enumGLogDoorMode.LOG_CLOSE_IREGAL:
                    vstrTmp += "Illegal Close"; break;
                case (int)enumGLogDoorMode.LOG_OPEN_COVER:
                    vstrTmp += "Cover Open"; break;
                case (int)enumGLogDoorMode.LOG_CLOSE_COVER:
                    vstrTmp += "Cover Close"; break;
                case (int)enumGLogDoorMode.LOG_OPEN_DOOR:
                    vstrTmp += "Open door"; break;
                case (int)enumGLogDoorMode.LOG_OPEN_DOOR_THREAT:
                    vstrTmp += "Open Door as Threat"; break;
            }
            if (vstrTmp == "") vstrTmp = "--";
            return vstrTmp;
        }


        public static String GetVerifyModeString(Int32 nVerifyMode)
        {
            String vRet = "";
            int vByteCount = 4;
            byte[] vbyteKind = new byte[vByteCount];
            int vFirstKind, vSecondKind;
            vbyteKind = BitConverter.GetBytes(nVerifyMode);
            for (int nIndex = vByteCount - 1; nIndex >= 0; nIndex--)
            {
                vFirstKind = vSecondKind = vbyteKind[nIndex];
                vFirstKind = vFirstKind & 0xF0;
                vSecondKind = vSecondKind & 0x0F;
                vFirstKind = vFirstKind >> 4;
                if (vFirstKind == 0) break;
                if (nIndex < vByteCount - 1)
                    vRet += "+";
                switch (vFirstKind)
                {
                    case (int)enumVerifyKind.VK_FP: vRet += "FP"; break;
                    case (int)enumVerifyKind.VK_PASS: vRet += "PASS"; break;
                    case (int)enumVerifyKind.VK_CARD: vRet += "CARD"; break;
                    case (int)enumVerifyKind.VK_FACE: vRet += "FACE"; break;
                    case (int)enumVerifyKind.VK_VEIN: vRet += "VEIN"; break;
                    case (int)enumVerifyKind.VK_IRIS: vRet += "IRIS"; break;
                }
                if (vSecondKind == 0) break;
                vRet += "+";
                switch (vSecondKind)
                {
                    case (int)enumVerifyKind.VK_FP: vRet += "FP"; break;
                    case (int)enumVerifyKind.VK_PASS: vRet += "PASS"; break;
                    case (int)enumVerifyKind.VK_CARD: vRet += "CARD"; break;
                    case (int)enumVerifyKind.VK_FACE: vRet += "FACE"; break;
                    case (int)enumVerifyKind.VK_VEIN: vRet += "VEIN"; break;
                    case (int)enumVerifyKind.VK_IRIS: vRet += "IRIS"; break;
                }
            }
            //nVerifyMode.
            if (vRet == "") vRet = "--";
            return vRet;
        }
    }

    public class UserIdInfo
    {
        public const Int32 USER_ID_LEN = 16;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = USER_ID_LEN)]
        private byte[] UserId;

        public byte Privilege;
        public byte Enabled;

        public byte PasswordFlag
        {
            get { return (byte)flagEnrolled[sctPassword]; }
            set { flagEnrolled[sctPassword] = (byte)value; }
        }
        public byte CardFlag
        {
            get { return (byte)flagEnrolled[sctCard]; }
            set { flagEnrolled[sctCard] = (byte)value; }
        }
        public byte FaceFlag
        {
            get { return (byte)flagEnrolled[sctFace]; }
            set { flagEnrolled[sctFace] = (byte)value; }
        }
        public byte FpCount
        {
            get { return (byte)flagEnrolled[sctFpCount]; }
            set { flagEnrolled[sctFpCount] = (byte)value; }
        }
        public byte VeinCount
        {
            get { return (byte)flagEnrolled[sctVeinCount]; }
            set { flagEnrolled[sctVeinCount] = (byte)value; }
        }

        public const Int32 STRUCT_SIZE = 20;        // sizeof(USER_ID_CIF11)

        //{ Backup number constant
        public const Int32 BACKUP_FP_0 = 0;        // Finger 0
        public const Int32 BACKUP_FP_1 = 1;        // Finger 1
        public const Int32 BACKUP_FP_2 = 2;        // Finger 2
        public const Int32 BACKUP_FP_3 = 3;        // Finger 3
        public const Int32 BACKUP_FP_4 = 4;        // Finger 4
        public const Int32 BACKUP_FP_5 = 5;        // Finger 5
        public const Int32 BACKUP_FP_6 = 6;        // Finger 6
        public const Int32 BACKUP_FP_7 = 7;        // Finger 7
        public const Int32 BACKUP_FP_8 = 8;        // Finger 8
        public const Int32 BACKUP_FP_9 = 9;        // Finger 9
        public const Int32 BACKUP_PSW = 10;        // Password
        public const Int32 BACKUP_CARD = 11;       // Card
        public const Int32 BACKUP_FACE = 12;       // Face
        public const Int32 BACKUP_VEIN_0 = 20;     // Vein 0
        //}

        public UserIdInfo()
        {
            UserId = new byte[USER_ID_LEN];
            Privilege = 0;
            Enabled = 0;

            PasswordFlag = 0;
            CardFlag = 0;
            FaceFlag = 0;
            FpCount = 0;
            VeinCount = 0;

            flagEnrolled = new BitVector32(0);
        }

        public UserIdInfo(byte[] abytUserIdInfo)
        {
            if (abytUserIdInfo.Length != STRUCT_SIZE)
                return;
            UserId = new byte[USER_ID_LEN];
            Buffer.BlockCopy(abytUserIdInfo, 0,
                           UserId, 0,
                           USER_ID_LEN);
            Privilege = abytUserIdInfo[16];
            Enabled = abytUserIdInfo[17];
            flagEnrolled = new BitVector32(BitConverter.ToInt16(abytUserIdInfo, 18));
        }

        public string GetUserID()
        {
            return System.Text.Encoding.Default.GetString(UserId).TrimEnd('\0');
        }

        public void GetBackupNumberEnrolledFlag(out byte[] abytEnrolledFlag)
        {
            abytEnrolledFlag = new byte[20];
            Array.Clear(abytEnrolledFlag, 0, 20);

            if ((byte)flagEnrolled[sctPassword] == 1)
                abytEnrolledFlag[BACKUP_PSW] = 1;

            if ((byte)flagEnrolled[sctCard] == 1)
                abytEnrolledFlag[BACKUP_CARD] = 1;

            if ((byte)flagEnrolled[sctFace] == 1)
                abytEnrolledFlag[BACKUP_FACE] = 1;

            int fpcnt = flagEnrolled[sctFpCount];
            int k;

            for (k = 0; k < fpcnt; k++)
                abytEnrolledFlag[BACKUP_FP_0 + k] = 1;
        }

        public void SetBackupNumberEnrolledFlag(byte[] abytEnrolledFlag)
        {
            if (abytEnrolledFlag.Length < 13)
                return;

            flagEnrolled = new BitVector32(0);
            if (abytEnrolledFlag[BACKUP_PSW] == 1)
                flagEnrolled[sctPassword] = 1;

            if (abytEnrolledFlag[BACKUP_CARD] == 1)
                flagEnrolled[sctCard] = 1;

            if (abytEnrolledFlag[BACKUP_FACE] == 1)
                flagEnrolled[sctFace] = 1;

            int fpcnt = 0;
            int k;
            for (k = 0; k < 10; k++)
            {
                if (abytEnrolledFlag[BACKUP_FP_0 + k] == 1)
                    fpcnt++;
            }
            flagEnrolled[sctFpCount] = (byte)fpcnt;
        }

        public void GetUserIdInfo(out byte[] abytUserIdInfo)
        {
            abytUserIdInfo = new byte[8];


            Buffer.BlockCopy(UserId, 0,
                           abytUserIdInfo, 0,
                           USER_ID_LEN);

            

            abytUserIdInfo[16] = Privilege;
            abytUserIdInfo[17] = Enabled;

            Buffer.BlockCopy(
                    BitConverter.GetBytes((UInt16)flagEnrolled.Data), 0,
                    abytUserIdInfo, 18,
                    2);
        }

        internal BitVector32 flagEnrolled;
        internal static readonly BitVector32.Section sctPassword = BitVector32.CreateSection(1);
        internal static readonly BitVector32.Section sctCard = BitVector32.CreateSection(1, sctPassword);
        internal static readonly BitVector32.Section sctFace = BitVector32.CreateSection(1, sctCard);
        internal static readonly BitVector32.Section sctFpCount = BitVector32.CreateSection((1 << 4) - 1, sctFace);
        internal static readonly BitVector32.Section sctVeinCount = BitVector32.CreateSection((1 << 6) - 1, sctFpCount);
    }
}
