<%@ page language="C#" autoeventwireup="true" inherits="FKAttend, App_Web_lofxcc4m" enableEventValidation="false" %>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title>Untitled Page</title>
</head>
<body style="font-weight: 700">
    <form id="form1" runat="server">
    <div style="border: thin hidden #00FF00; font-size: xx-large; background-color: #C0C0D0;">
    
    &nbsp;&nbsp; FKAttend BS Sample <asp:Label ID="Version" runat="server"></asp:Label></div>
    <br />
    <asp:ScriptManager ID="ScriptManager1" runat="server"></asp:ScriptManager>
        <div>
         <asp:UpdatePanel ID="UpdatePanel2" runat="server" UpdateMode="Always">
        <ContentTemplate>
    <asp:Panel ID="Panel1" runat="server" BorderStyle="Groove" Height="58px" 
        BackColor="#EEEEEE">
        <br />
        &nbsp;
        <asp:Label ID="Label1" runat="server" Text="Devices:       " Font-Size="Large"></asp:Label>
        <asp:DropDownList ID="Device_List" runat="server" Height="29px" Width="130px" 
            onselectedindexchanged="Device_List_SelectedIndexChanged">
        </asp:DropDownList>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:TextBox ID="mTransIdTxt" runat="server" Visible="False"></asp:TextBox>
        <br />
        <br />
    </asp:Panel>
    <asp:Panel ID="Panel2" runat="server" BorderStyle="Groove" Height="98px" 
        style="margin-top: 11px; margin-bottom: 22px" BackColor="#EEEEEE">
        &nbsp;&nbsp;<asp:Label ID="Label7" runat="server" Font-Size="Large" Text="Device Info"></asp:Label>
        <br />
        &nbsp;<br />
        &nbsp;&nbsp;
        <asp:Label ID="Label2" runat="server" Text="ID:  "></asp:Label>
        <asp:Label ID="LDev_ID" runat="server"></asp:Label>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Label ID="Label3" runat="server" Text="Name:  "></asp:Label>
        <asp:Label ID="LDev_Name" runat="server"></asp:Label>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Label ID="Label4" runat="server" Text="Firmware:  "></asp:Label>
        <asp:Label ID="LDev_Firmware" runat="server"></asp:Label>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Label ID="Label6" runat="server" Text="Door:  "></asp:Label>
        <asp:Label ID="LDev_Door" runat="server"></asp:Label>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Label ID="Label12" runat="server" Text="Barcode:  "></asp:Label>
        <asp:Label ID="LDev_Barcode" runat="server"></asp:Label>
        <br />
        <br />
        &nbsp;&nbsp;
        <asp:Label ID="Label5" runat="server" Text="Support:"></asp:Label>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Label ID="LDev_Support" runat="server"></asp:Label>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Label ID="Label10" runat="server" Text="Update Time:"></asp:Label>
        &nbsp;
        <asp:Label ID="UpdateTimeTxt" runat="server"></asp:Label>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Label ID="Label11" runat="server" Text="Connect Status:"></asp:Label>
        <asp:Image ID="StatusImg" runat="server" Height="20px" 
            ImageUrl="~/Image/redon.png" Width="20px" />
        <br />
    </asp:Panel>
    <asp:Panel ID="Panel3" runat="server" BorderStyle="Groove" Height="178px" 
        style="margin-bottom: 27px" BackColor="#EEEEEE">
        &nbsp;
        <asp:Label ID="Label8" runat="server" Font-Size="Large" Text="Operations"></asp:Label>
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Button ID="UserManBtn" runat="server" Height="30px" Text="User Manage" 
            Width="150px" onclick="UserManBtn_Click" />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Button ID="RTLogBtn" runat="server" Height="30px" 
            Text="Real-time Log View" Width="150px" onclick="RTLogBtn_Click" />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Button ID="RTOperBtn" runat="server" Height="30px" 
            Text="Real-time Operation View" Width="200px" onclick="RTOperBtn_Click" />
        <br />
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Button ID="LogManBtn" runat="server" Height="30px" Text="Log Manage" 
            Width="150px" onclick="LogManBtn_Click" />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Button ID="RTEnrollBtn" runat="server" Height="30px" 
            Text="Real-time Enroll View" Width="150px" onclick="RTEnrollBtn_Click" />
        <br />
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Button ID="DevManBtn" runat="server" Height="30px" Text="Device Manage" 
            Width="150px" onclick="DevManBtn_Click" />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:Button ID="PassManBtn" runat="server" Height="30px" Text="Pass Manage" 
            onclick="PassManBtn_Click" Width="150px" />
        <asp:Button ID="OneTimePassBtn" runat="server" Height="30px" Text="One-Time Pass" 
            onclick="OneTimePassBtn_Click" Width="150px" />
    </asp:Panel>
    <asp:Panel ID="Panel4" runat="server" BorderStyle="Groove" Height="71px" 
        BackColor="#EEEEEE">
        &nbsp;
        <asp:Label ID="Label9" runat="server" Text="Status" Font-Size="Large"></asp:Label>
        <br />
        &nbsp;
        <br />
        &nbsp;&nbsp;&nbsp;
        <asp:Label ID="StatusTxt" runat="server"></asp:Label>
    </asp:Panel>
    <asp:timer ID="Timer" runat="server" Interval="100" OnTick="Timer_Watch"></asp:timer>
        </ContentTemplate>
        </asp:UpdatePanel>
    </div>
    
    </form>
</body>
</html>
