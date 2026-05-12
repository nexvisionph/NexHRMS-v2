using System;
using System.Runtime.InteropServices;
using System.Collections.Specialized;

namespace FKDataHS101
{

    //{ 다음의 2개의 구조체는 하오쑨 4775 리눅스얼굴기대에서 리용하는 구조체들이다.
    /*
    typedef struct tagGLOG_DATA_CIF11
    {
        unsigned long        UserID;
        unsigned char        DataVer;
        unsigned char        InOut; //FlagResult
        unsigned char        VerifyMode;
        unsigned char        Second;
        unsigned long        Valid : 2;
        unsigned long        Year : 10;  // Real Year-1900
        unsigned long        Month : 4;
        unsigned long        Day : 5;
        unsigned long        Hour : 5;
        unsigned long        Minute : 6;
    } GLOG_DATA_CIF11;  // size = 12 byte

    typedef struct tagUSER_ID_CIF11 {
        unsigned long UserID;			// 0, 4
        unsigned char Privilege;		// 4, 1
        unsigned char Enabled;			// 4, 2
        unsigned short PasswordFlag :1;	// 6, 2
        unsigned short CardFlag :1;		// 6, 2
        unsigned short FaceFlag :1;		// 6, 2
        unsigned short FpCount :4;		// 6, 2
        unsigned short VeinCount :6;	// 6, 2
        unsigned short Reseved :3;		// 6, 2
    } USER_ID_CIF11;  // size = 8 byte
    */
    //}

    public class GLog
    {
        public const Int32 STRUCT_SIZE = 12;        // sizeof(GLOG_DATA_CIF11)

        public UInt32 UserId;
        public byte IoMode;
        public byte VerifyMode;

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
            UserId = 0;
            IoMode = 0;
            VerifyMode = 0;
            Second = 0;
            tmLog = new BitVector32(0);
        }

        public GLog(byte[] abytLog)
        {
            if (abytLog.Length != STRUCT_SIZE)
                return;

            UserId = (UInt32)BitConverter.ToInt32(abytLog, 0);
            IoMode = abytLog[5];
            VerifyMode = abytLog[6];
            Second = abytLog[7];
            tmLog = new BitVector32(BitConverter.ToInt32(abytLog, 8));
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

        public void GetLogData(out byte[] abytLog)
        {
            abytLog = new byte[12];

            Buffer.BlockCopy(
                    BitConverter.GetBytes(UserId), 0,
                    abytLog, 0,
                    4);

            abytLog[4] = 0;
            abytLog[5] = IoMode;
            abytLog[6] = VerifyMode;
            abytLog[7] = Second;

            Buffer.BlockCopy(
                    BitConverter.GetBytes((UInt32)tmLog.Data), 0,
                    abytLog, 8,
                    4);
        }


        //{ Log InOut Mode Constant    
        public const Int32 IO_MODE_OUT = 0;
        public const Int32 IO_MODE_IN = 1;
        public const Int32 IO_MODE_CHKIN = 1;
        public const Int32 IO_MODE_CHKOUT = 2;
        public const Int32 IO_MODE_BRKIN = 3;
        public const Int32 IO_MODE_BRKOUT = 4;
        public const Int32 IO_MODE_OVTIN = 5;
        public const Int32 IO_MODE_OVTOUT = 6;
        //}
        public static string GetInOutModeString(Int32 aIoMode)
        {
            string sRet = "";
            switch (aIoMode)
            {
                case IO_MODE_IN:
                    sRet = "IN";
                    break;

                case IO_MODE_OUT:
                case IO_MODE_CHKOUT:
                    sRet = "OUT";
                    break;

                case IO_MODE_BRKIN:
                    sRet = "BRK_IN";
                    break;

                case IO_MODE_BRKOUT:
                    sRet = "BRK_OUT";
                    break;

                case IO_MODE_OVTIN:
                    sRet = "OVT_IN";
                    break;

                case IO_MODE_OVTOUT:
                    sRet = "OVT_OUT";
                    break;

                default:
                    sRet = "C_" + aIoMode.ToString();
                    break;
            }
            return sRet;
        }
        //{ Log Verify Mode Constant
        public const Int32 VERIFY_MODE_FP = 1;
        public const Int32 VERIFY_MODE_PASSWORD = 2;
        public const Int32 VERIFY_MODE_IDCARD = 3;
        public const Int32 VERIFY_MODE_FP_PASSWORD = 4;
        public const Int32 VERIFY_MODE_FP_IDCARD = 5;
        public const Int32 VERIFY_MODE_PASSWORD_FP = 6;
        public const Int32 VERIFY_MODE_IDCARD_FP = 7;
        public const Int32 VERIFY_MODE_FACE = 20;
        public const Int32 VERIFY_MODE_FACE_IDCARD = 21;
        public const Int32 VERIFY_MODE_FACE_PASSWORD = 22;
        public const Int32 VERIFY_MODE_IDCARD_FACE = 23;
        public const Int32 VERIFY_MODE_PASSWORD_FACE = 24;
        //}
        public static string GetVerifyModeString(Int32 aVerifyMode)
        {
            string sRet = "";
            switch (aVerifyMode)
            {
                case VERIFY_MODE_FP:
                    sRet = "[\"FP\"]";
                    break;

                case VERIFY_MODE_PASSWORD:
                    sRet = "[\"PASSWORD\"]";
                    break;

                case VERIFY_MODE_IDCARD:
                    sRet = "[\"IDCARD\"]";
                    break;

                case VERIFY_MODE_FP_PASSWORD:
                    sRet = "[\"FP\",\"PASSWORD\"]";
                    break;

                case VERIFY_MODE_FP_IDCARD:
                    sRet = "[\"FP\",\"IDCARD\"]";
                    break;

                case VERIFY_MODE_PASSWORD_FP:
                    sRet = "[\"PASSWORD\",\"FP\"]";
                    break;

                case VERIFY_MODE_IDCARD_FP:
                    sRet = "[\"IDCARD\",\"FP\"]";
                    break;

                case VERIFY_MODE_FACE:
                    sRet = "[\"FACE\"]";
                    break;

                case VERIFY_MODE_FACE_PASSWORD:
                    sRet = "[\"FACE\",\"PASSWORD\"]";
                    break;

                case VERIFY_MODE_FACE_IDCARD:
                    sRet = "[\"FACE\",\"IDCARD\"]";
                    break;

                case VERIFY_MODE_PASSWORD_FACE:
                    sRet = "[\"PASSWORD\",\"FACE\"]";
                    break;

                case VERIFY_MODE_IDCARD_FACE:
                    sRet = "[\"IDCARD\",\"FACE\"]";
                    break;

                default:
                    break;
            }
            return sRet;
        }
    }

    public class UserIdInfo
    {
        public UInt32 UserId;
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

        public const Int32 STRUCT_SIZE = 8;        // sizeof(USER_ID_CIF11)

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
            UserId = 0;
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

            UserId = (UInt32)BitConverter.ToInt32(abytUserIdInfo, 0);
            Privilege = abytUserIdInfo[4];
            Enabled = abytUserIdInfo[5];
            flagEnrolled = new BitVector32(BitConverter.ToInt16(abytUserIdInfo, 6));
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

            Buffer.BlockCopy(
                    BitConverter.GetBytes(UserId), 0,
                    abytUserIdInfo, 0,
                    4);

            abytUserIdInfo[4] = Privilege;
            abytUserIdInfo[5] = Enabled;

            Buffer.BlockCopy(
                    BitConverter.GetBytes((UInt16)flagEnrolled.Data), 0,
                    abytUserIdInfo, 6,
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
