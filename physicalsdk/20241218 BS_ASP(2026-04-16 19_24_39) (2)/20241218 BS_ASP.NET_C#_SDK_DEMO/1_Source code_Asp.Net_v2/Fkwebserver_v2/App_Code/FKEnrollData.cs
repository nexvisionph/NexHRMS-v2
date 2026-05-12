using System;
using System.Runtime.InteropServices;
using System.Collections.Specialized;

namespace FKWeb
{
    public class EnrollData
    {
        public EnrollData()
        {
            BackupNumber = -1;
            bytData = new byte[0];
        }

        public EnrollData(int anBackupNumber, byte[] abytData)
        {
            BackupNumber = -1;
            bytData = new byte[0];

            if (anBackupNumber >= 0)
            {
                BackupNumber = anBackupNumber;
                if (abytData.Length > 0)
                {
                    bytData = new byte[abytData.Length];
                    abytData.CopyTo(bytData, 0);
                }
            }
        }

        public bool IsValid()
        {
            if (BackupNumber < 0)
                return false;
            if (bytData.Length < 1)
                return false;

            return true;
        }

        public int BackupNumber;
        public byte [] bytData;
    }
}
