using System;
using System.Runtime.InteropServices;
using System.Collections.Specialized;

namespace FKDataHS100
{

    //{ 다음의 2개의 구조체는 하오쑨 4775 리눅스얼굴기대에서 리용하는 구조체들이다.
    /*
     typedef struct tagGLOG_DATA_CIF10
     {
	    unsigned char	Valid;				// 1
	    unsigned char	Kind  : 6;
	    unsigned char	InOut : 2;			// 2
	    unsigned char	BackupNumber;	// 3
	    unsigned char	Second;			// 4	
	    unsigned long 	User_ID;			// 8

	    unsigned short	Year    : 12;		
	    unsigned short	Month	: 4;			// 10
	    unsigned short	Day		: 5;
	    unsigned short	Hour	: 5;
	    unsigned short	Minute	: 6;			// 12
     } GLOG_DATA_CIF10; /* Length = 12byte 
     * 
     typedef struct tagUSER_ID_CIF10
     {
	        unsigned char	Enabled;    //1
	        unsigned char	Privilege;  //2
	        unsigned char	BackupNumber;//3
	        unsigned char	Reserved;//4
	
	        unsigned long	UserId;	//8
     } USER_ID_CIF10;

     * 
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

        public byte Vaild; //must be 1
       
       // public byte IoMode;
       // public byte VerifyMode;

        public byte IoMode
        {
            get { return (byte)tmMode[sctInOut]; }
            set { tmMode[sctInOut] = (byte)value; }
        }
        public byte VerifyMode
        {
            get { return (byte)tmMode[sctKind]; }
            set { tmMode[sctKind] = (byte)value; }
        }

       

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
        internal BitVector32 tmMode;
        public byte BackupNumber;
        public byte Second;
        public UInt32 UserId;
        internal BitVector32 tmLog;
        

        internal static readonly BitVector32.Section sctKind = BitVector32.CreateSection((1 << 6) - 1);
        internal static readonly BitVector32.Section sctInOut = BitVector32.CreateSection((1 << 2) - 1, sctKind);
        

        internal static readonly BitVector32.Section sctYear = BitVector32.CreateSection((1 << 12) - 1);
        internal static readonly BitVector32.Section sctMonth = BitVector32.CreateSection((1 << 4) - 1, sctYear);
        internal static readonly BitVector32.Section sctDay = BitVector32.CreateSection((1 << 5) - 1, sctMonth);
        internal static readonly BitVector32.Section sctHour = BitVector32.CreateSection((1 << 5) - 1, sctDay);
        internal static readonly BitVector32.Section sctMinute = BitVector32.CreateSection((1 << 6) - 1, sctHour);

        public GLog()
        {
            Vaild = 0;
            UserId = 0;
            BackupNumber = 0;
            //IoMode = 0;
            //VerifyMode = 0;
            Second = 0;
            tmMode = new BitVector32(0);
            tmLog = new BitVector32(0);
        }

        public GLog(byte[] abytLog)
        {
            if (abytLog.Length != STRUCT_SIZE)
                return;
            Vaild = abytLog[0];
            tmMode = new BitVector32(BitConverter.ToChar(abytLog, 1));
            Second = abytLog[3];
            UserId = (UInt32)BitConverter.ToInt32(abytLog, 4);
            tmLog = new BitVector32(BitConverter.ToInt32(abytLog, 8));
        }

        public bool IsValidIoTime()
        {
            if (Year < 1900 || Year > 3000)
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

            return (Convert.ToString(Year) + "-" +
                    Convert.ToString(Month) + "-" +
                    Convert.ToString(Day) + " " +
                    Convert.ToString(Hour) + ":" +
                    Convert.ToString(Minute) + ":" +
                    Convert.ToString(Second));
        }

        public void GetLogData(out byte[] abytLog)
        {
            abytLog = new byte[12];

            abytLog[0] = 1;
            Buffer.BlockCopy(
                    BitConverter.GetBytes((Char)tmMode.Data), 0,
                    abytLog, 1,
                    1);
            abytLog[2] = 0;
            abytLog[3] = Second;

            Buffer.BlockCopy(
                    BitConverter.GetBytes(UserId), 0,
                    abytLog, 4,
                    4);

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
      //  public const Int32 VERIFY_MODE_FP = 1;
        public const Int32 LOG_FPVERIFY		= 0x01;		/* Fp Verify           		   */
        public const Int32 LOG_PASSVERIFY		=0x02;		/* Pass Verify                 */
        public const Int32 LOG_CARDVERIFY		=0x03;		/* Card Verify                 */
        public const Int32 LOG_FPPASS_VERIFY	=0x04;		/* Pass+Fp Verify      		   */
        public const Int32 LOG_FPCARD_VERIFY	=0x05;		/* Card+Fp Verify      		   */
        public const Int32 LOG_PASSFP_VERIFY	=0x06;		/* Pass+Fp Verify      		   */
        public const Int32 LOG_CARDFP_VERIFY	=0x07;		/* Card+Fp Verify      		   */
        public const Int32 LOG_JOB_NO_VERIFY	=0x08;		/* Job number Verify  		   */
        public const Int32 LOG_CARDPASS_VERIFY	=0x09;		/* Card+Pass Verify    		   */
        public const Int32 LOG_PASSCARD_VERIFY	=0x89;		/* Pass+Card Verify    		   */


       /* public const Int32 VERIFY_MODE_PASSWORD = 2;
        public const Int32 VERIFY_MODE_IDCARD = 3;
        public const Int32 VERIFY_MODE_FP_PASSWORD = 4;
        public const Int32 VERIFY_MODE_FP_IDCARD = 5;
        public const Int32 VERIFY_MODE_PASSWORD_FP = 6;
        public const Int32 VERIFY_MODE_IDCARD_FP = 7;
        public const Int32 VERIFY_MODE_FACE = 20;
        public const Int32 VERIFY_MODE_FACE_IDCARD = 21;
        public const Int32 VERIFY_MODE_FACE_PASSWORD = 22;
        public const Int32 VERIFY_MODE_IDCARD_FACE = 23;
        public const Int32 VERIFY_MODE_PASSWORD_FACE = 24;*/
        //}
        public static string GetVerifyModeString(Int32 aVerifyMode)
        {
            string sRet = "";
            switch (aVerifyMode)
            {
                case LOG_FPVERIFY:
                    sRet = "[\"FP\"]";
                    break;

                case LOG_PASSVERIFY:
                    sRet = "[\"PASSWORD\"]";
                    break;

                case LOG_CARDVERIFY:
                    sRet = "[\"IDCARD\"]";
                    break;

                case LOG_FPPASS_VERIFY:
                    sRet = "[\"FP\",\"PASSWORD\"]";
                    break;

                case LOG_FPCARD_VERIFY:
                    sRet = "[\"FP\",\"IDCARD\"]";
                    break;

                case LOG_PASSFP_VERIFY:
                    sRet = "[\"PASSWORD\",\"FP\"]";
                    break;

                case LOG_CARDFP_VERIFY:
                    sRet = "[\"IDCARD\",\"FP\"]";
                    break;

                case LOG_JOB_NO_VERIFY:
                    sRet = "[\"JOB NO\"]";
                    break;

                case LOG_CARDPASS_VERIFY:
                    sRet = "[\"IDCARD\",\"PASSWORD\"]";
                    break;

                case LOG_PASSCARD_VERIFY:
                    sRet = "[\"PASSWORD\",\"IDCARD\"]";
                    break;
/*
                case VERIFY_MODE_PASSWORD_FACE:
                    sRet = "[\"PASSWORD\",\"FACE\"]";
                    break;

                case VERIFY_MODE_IDCARD_FACE:
                    sRet = "[\"IDCARD\",\"FACE\"]";
                    break;
                    */
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
        public byte BackupNumber;

     /*   public byte PasswordFlag
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
        }*/

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
       
        //}

        public UserIdInfo()
        {
            UserId = 0;
            Privilege = 0;
            Enabled = 0;
            BackupNumber = 0;
            /*PasswordFlag = 0;
            CardFlag = 0;
            FaceFlag = 0;
            FpCount = 0;
            VeinCount = 0;

            flagEnrolled = new BitVector32(0);*/
        }

        public UserIdInfo(byte[] abytUserIdInfo)
        {
            if (abytUserIdInfo.Length != STRUCT_SIZE)
                return;
            Enabled = abytUserIdInfo[0];
            Privilege = abytUserIdInfo[1];
            BackupNumber = abytUserIdInfo[2];
            UserId = (UInt32)BitConverter.ToInt32(abytUserIdInfo, 4);
            /*Privilege = abytUserIdInfo[4];
            Enabled = abytUserIdInfo[5];
            flagEnrolled = new BitVector32(BitConverter.ToInt16(abytUserIdInfo, 6));*/
        }
/*
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
*/
        public void GetUserIdInfo(out byte[] abytUserIdInfo)
        {
            abytUserIdInfo = new byte[8];

            abytUserIdInfo[0] = Enabled;
            abytUserIdInfo[1] = Privilege;
            abytUserIdInfo[2] = BackupNumber;

            Buffer.BlockCopy(
                    BitConverter.GetBytes(UserId), 0,
                    abytUserIdInfo, 4,
                    4);

       }

     }
}
