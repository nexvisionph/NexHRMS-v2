<%@ Page Language="C#" AutoEventWireup="true" CodeFile="OneTimePass.aspx.cs" Inherits="OneTimePass" %>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title>One-Time Pass</title>
    <style type="text/css">
        #form1
        {
            margin-bottom: 30px;
        }
    </style></head>
<body>
    <form id="form1" runat="server">
    <div>
    <div style="border: thin hidden #00FF00; font-size: xx-large; background-color: #C0C0D0; height: 49px; margin-bottom: 17px;">
    
    &nbsp;&nbsp; FKAttend BS Sample <asp:Label ID="Version" runat="server"></asp:Label>
    
    </div>
    
    </div>
        <asp:Panel ID="Panel1" runat="server" BackColor="#CCCCCC" Font-Size="Large" 
            Height="28px">
            &nbsp;&nbsp;&nbsp;&nbsp; One-time Pass&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:LinkButton ID="goback" runat="server" onclick="goback_Click">Go Home</asp:LinkButton>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </asp:Panel>    
        
            <div>
        ID：<asp:TextBox ID="txb_UserID" runat="server" Height="30px"  Width="50px"></asp:TextBox>
        Name：<asp:TextBox ID="txb_UserName" runat="server" Height="30px"  Width="100px"></asp:TextBox>
        FromTime：<asp:TextBox ID="txb_FromTime" runat="server" Height="30px"  Width="150px"></asp:TextBox>
        Hours：<asp:TextBox ID="txb_Hours" runat="server" Height="30px"  Width="50px"></asp:TextBox>
        <asp:Button ID="btn_CreateQRCodec" runat="server" Text=" O K " 
            onclick="btn_CreateQRCodec_Click" /><br /><br />
        <asp:Image ID="Img_QRImg" runat="server" Width="200px" Height="200px" />
    </div>
                    <asp:Panel ID="Panel5" runat="server" BackColor="#EEEEEE" BorderStyle="Groove" 
                Height="44px" style="margin-top: 11px">
                &nbsp;
                <asp:Label ID="Label9" runat="server" Font-Size="Large" Text="Status"></asp:Label>
                <br />
                &nbsp; &nbsp;&nbsp;&nbsp;
                <asp:Label ID="StatusTxt" runat="server">WAIT ...</asp:Label>
            </asp:Panel>


                            </form>

</body>
</html>
