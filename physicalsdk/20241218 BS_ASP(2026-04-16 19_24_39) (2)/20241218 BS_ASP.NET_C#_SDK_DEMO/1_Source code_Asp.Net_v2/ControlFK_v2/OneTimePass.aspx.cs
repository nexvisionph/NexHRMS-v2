using System;
using System.Collections.Generic;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Drawing;
using System.Drawing.Imaging;
using ThoughtWorks.QRCode.Codec;

public partial class OneTimePass : System.Web.UI.Page
{
    protected void Page_Load(object sender, EventArgs e)
    {
        if (this.txb_UserID.Text == "") this.txb_UserID.Text = "1";
        if (this.txb_FromTime.Text == "") this.txb_FromTime.Text = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
        if (this.txb_Hours.Text == "") this.txb_Hours.Text = "2";
    }


    protected void goback_Click(object sender, EventArgs e)
    {
        Response.Redirect("Default.aspx");
    }

    protected void Timer_Watch(object sender, EventArgs e)
    {
        //label is on first panel



    }

    private void CreateQRImg(string str)
    {
        Bitmap bt;
        string EncoderStr = str;
        //生成设置编码实例
        QRCodeEncoder QRcode = new QRCodeEncoder();
        //设置二维码的规模，默认4
        QRcode.QRCodeScale = 4;
        //设置二维码的版本，默认7
        QRcode.QRCodeVersion = 7;
        //设置错误校验级别，默认中等
        QRcode.QRCodeErrorCorrect = QRCodeEncoder.ERROR_CORRECTION.M;
        //设置二维码的背景色
        QRcode.QRCodeBackgroundColor = Color.White;
        //设置二维码的前景色
        QRcode.QRCodeForegroundColor = Color.Black;
        //生成二维码图片
        //bt = QRcode.Encode(EncoderStr, Encoding.UTF8);
        bt = QRcode.Encode(EncoderStr);
        //二维码图片的名称
        string filename = DateTime.Now.ToString("yyyyMMddHHmmss");
        //保存二维码图片在photos路径下
        string AbsImgUri = Server.MapPath(".") + "\\images\\" + filename + ".jpg";

        //bt.Save(Server.MapPath("~/images/") + filename + ".jpg");
        bt.Save(AbsImgUri);
        //图片控件要显示的二维码图片路径
        this.Img_QRImg.ImageUrl = ".\\images\\" + filename + ".jpg";
    }
    protected void btn_CreateQRCodec_Click(object sender, EventArgs e)
    {
        string msg = "FKATTEND_" +
    this.txb_UserID.Text + "_" +
    this.txb_UserName.Text + "_" +
    this.txb_FromTime.Text + "_" +
    this.txb_Hours.Text + "_" +
    this.StatusTxt.Text;
        
        msg = msg.PadLeft(msg.Length + (80 - msg.Length) / 2, '(');
        msg = msg.PadRight(80, ')');
        byte[] tmp = System.Text.Encoding.UTF8.GetBytes(msg);
        msg = Convert.ToBase64String(tmp);

        CreateQRImg(msg);
    }
}