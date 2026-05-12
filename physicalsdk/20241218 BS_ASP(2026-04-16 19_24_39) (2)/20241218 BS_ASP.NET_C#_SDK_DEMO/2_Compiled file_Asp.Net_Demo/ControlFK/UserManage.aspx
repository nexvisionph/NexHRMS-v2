<%@ page language="C#" autoeventwireup="true" inherits="UserManage, App_Web_lofxcc4m" enableEventValidation="false" %>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title>User Manage</title>
    <style type="text/css">
        #form1
        {
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <form id="form1" runat="server" enctype="multipart/form-data">
    <div>
    
    <div style="border: thin hidden #00FF00; font-size: xx-large; background-color: #C0C0D0; height: 49px; margin-bottom: 17px;">
    
    &nbsp;&nbsp; FKAttend BS Sample <asp:Label ID="Version" runat="server"></asp:Label></div>
    
    </div>
     <asp:ScriptManager ID="ScriptManager1" runat="server"></asp:ScriptManager>
        <div>
         <asp:UpdatePanel ID="UpdatePanel2" runat="server" UpdateMode="Always">
        <ContentTemplate>
        <asp:Panel ID="Panel1" runat="server" BackColor="#CCCCCC" Font-Size="Large" 
            Height="28px" style="margin-bottom: 7px">
            &nbsp;&nbsp;&nbsp;&nbsp; User Manage&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<asp:Label ID="Label1" runat="server" 
                Text="Device ID :"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;<asp:Label ID="DevID" runat="server"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<asp:Label ID="Label12" 
                runat="server" Text="Update Time:" Visible="False"></asp:Label>
            &nbsp;&nbsp;&nbsp;<asp:Label ID="UpdateTimeTxt" runat="server" Text="Label" 
                Visible="False"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<asp:Label ID="Label14" 
                runat="server" Text="Connect Status: " Visible="False"></asp:Label>
            <asp:Image ID="StatusImg" runat="server" Height="20px" 
                ImageUrl="~/Image/redon.png" Width="20px" Visible="False" />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:LinkButton ID="goback" runat="server" onclick="goback_Click">Go Home</asp:LinkButton>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </asp:Panel>

        
        <asp:Panel ID="Panel2" runat="server" BackColor="#EEEEEE" Height="40px" 
            style="margin-bottom: 8px">
            <asp:Label ID="Label2" runat="server" Text="User List"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:DropDownList ID="UserList" runat="server" 
                Width="130px" Enabled="False" 
                onselectedindexchanged="UserList_SelectedIndexChanged">
            </asp:DropDownList>
            
            &nbsp;&nbsp;<asp:Button ID="ReadUser_FirstBtn" runat="server" Enabled="False" onclick="ReadUser_FirstBtn_Click" 
                Text="|<" />
            &nbsp;&nbsp;<asp:Button ID="ReadUser_PrevBtn" runat="server" Enabled="False" onclick="ReadUser_PrevBtn_Click" 
                Text="<<" />
            &nbsp;&nbsp;<asp:Label ID="ReadUser_IndexLbl" runat="server" Text="0/0"></asp:Label>
            &nbsp;&nbsp;<asp:Button ID="ReadUser_NextBtn" runat="server" Enabled="False" onclick="ReadUser_NextBtn_Click" 
                Text=">>" />
            &nbsp;&nbsp;<asp:Button ID="ReadUser_LastBtn" runat="server" Enabled="False" onclick="ReadUser_LastBtn_Click" 
                Text=">|" />
            &nbsp;&nbsp;<asp:Button ID="UpdateUserListBtn" runat="server" Enabled="False" 
                onclick="UpdateUserListBtn_Click" Text="Update User List" Width="130px" />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </asp:Panel>
        
       
   
        <asp:Panel ID="Panel3" runat="server" BackColor="#EEEEEE" Height="380px" 
            style="margin-bottom: 6px">
            &nbsp;&nbsp;
            <asp:Label ID="Label3" runat="server" Text="User Infomation"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<asp:Button ID="ModifyBtn" runat="server" Enabled="False" onclick="ModifyBtn_Click" Text="Modify User" Width="130px" />
            <br />
            <table><tr><td style="border:1">
            <asp:Button ID="GetInfoBtn" runat="server" Text="Get User Info" Width="130px" 
                onclick="GetInfoBtn_Click" Enabled="False" />
            <br />
            <br />
            <asp:Button ID="SetInfoBtn" runat="server" Text="Set User Info" Width="130px" 
                onclick="SetInfoBtn_Click" Enabled="False" />
            <br />
            <br />
            <asp:Button ID="DeleteUserBtn" runat="server" Text="Delete User" 
                Width="130px" onclick="DeleteUserBtn_Click" Enabled="False" />
            <br />
            <br />
            <asp:Button ID="GetAllUserBtn" runat="server"  Enabled="False" Width="130px" 
                onclick="GetAllUserBtn_Click" Text="Get All User Info" />
            <br />
            <asp:Button ID="SetAllUserBtn" runat="server"  Enabled="False" Width="130px" 
                onclick="SetAllUserBtn_Click" Text="Set All User Info" />
            <br />
            <asp:Button ID="ClearBtn" runat="server" onclick="ClearBtn_Click"  Enabled="False" Width="130px" 
                Text="Clear In Device" />
            <br />
            <asp:Button ID="InitDBBtn" runat="server" onclick="InitDBBtn_Click"  Enabled="False" Width="130px" 
                Text="Clear In DB" />
                
            </td><td>
            &nbsp;&nbsp;&nbsp; <asp:Label ID="Label11" runat="server" Text="ID"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:TextBox ID="UserID" runat="server" Enabled="False"></asp:TextBox>
                    <asp:Button ID="NewBtn" runat="server" Enabled="False" onclick="NewBtn_Click" 
                        Text="New User ID" Width="130px" />
            <br />
            <br />
            &nbsp;&nbsp;&nbsp; <asp:Label ID="Label5" runat="server" Text="Name"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:TextBox ID="UserName" runat="server" Width="156px"></asp:TextBox>
            <asp:Button ID="SetNameBtn" runat="server" Text="Set Name"  Enabled="False" 
                onclick="SetNameBtn_Click"/>
            <br />
            <br />
            &nbsp;&nbsp;&nbsp; Privilige&nbsp;&nbsp;&nbsp;
            <asp:DropDownList ID="UserPriv" runat="server" Width="100px" Enabled="False">
                <asp:ListItem>USER</asp:ListItem>
                <asp:ListItem>MANAGER</asp:ListItem>
                <asp:ListItem>OPERATOR</asp:ListItem>
                <asp:ListItem Value="REGISTER">REGISTER</asp:ListItem>
            </asp:DropDownList>
            <asp:Button ID="SetPriviligeBtn" runat="server" Text="Set Privilige"  
                Enabled="False" onclick="SetPriviligeBtn_Click" />
            <br />
            <br />
            &nbsp;&nbsp;&nbsp;<asp:Label ID="Label7" runat="server" Text="Card"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:TextBox ID="CardNum" runat="server" Enabled="False"></asp:TextBox>
            <asp:Button ID="SetCardBtn" runat="server" Text="Set Card"  
                Enabled="False" onclick="SetCardBtn_Click" />
            <br />
            <br />
            &nbsp;&nbsp; Password&nbsp;
            <asp:TextBox ID="Password" runat="server" Enabled="False"></asp:TextBox>
            <asp:Button ID="SetPasswordBtn" runat="server" Text="Set Password"  
                Enabled="False" onclick="SetPasswordBtn_Click" />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:TextBox ID="mTransIdTxt" runat="server" Visible="False"></asp:TextBox>
            <asp:TextBox ID="mBatchTransIdTxt" runat="server" Visible="False"></asp:TextBox>
            <br />
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;
            <asp:CheckBox ID="EnableUser" runat="server" Text="Enable" Visible="False" />
            &nbsp;&nbsp;&nbsp;
            <asp:CheckBox ID="Fp" runat="server" Text="FingerPrint" Enabled="False" />
            &nbsp;&nbsp;&nbsp;
            <asp:CheckBox ID="Face" runat="server" Text="Face" Enabled="False" />
            &nbsp;&nbsp;&nbsp;
            <asp:CheckBox ID="Palm" runat="server" Text="Palm" Enabled="False" />
            <br />
            <br />
            </td><td>
            <asp:Image ID="UserPhoto" runat="server" Height="188px" Width="154px" 
                BorderColor="#666666" BorderWidth="2px" EnableTheming="False" 
                EnableViewState="False" />
            <asp:Literal ID="literal" runat="server"></asp:Literal>

            </td></tr></table>
            <asp:Button ID="CopyAllUserBtn" runat="server" OnClick="Copy_All_Uset_From_SelectedDevice" 
                Text="Copy All User Info From Device :" Enabled="False" />
            <asp:DropDownList ID="Device_List" runat="server" Height="29px" Width="130px" Enabled="False">
            </asp:DropDownList>
            <br />
            <br />
            <asp:Button ID="SetPhotoBtn" runat="server" OnClick="SetPhotoBtn_Clicked" 
                Text="Import Photo From Path:" Enabled="False" />
            <asp:TextBox ID="PhotoPath" runat="server" Width="156px"></asp:TextBox>
        </asp:Panel>
            <asp:Panel ID="Panel5" runat="server" BackColor="#EEEEEE" BorderStyle="Groove" 
                Height="44px" style="margin-top: 11px">
                &nbsp;
                <asp:Label ID="Label9" runat="server" Font-Size="Large" Text="Status"></asp:Label>
                <br />
                &nbsp; &nbsp;&nbsp;&nbsp;
                <asp:Label ID="StatusTxt" runat="server">WAIT ...</asp:Label>
            </asp:Panel>
        <asp:timer ID="Timer" runat="server" Interval="1000" OnTick="Timer_Watch" 
                    Enabled="True"></asp:timer>
        </ContentTemplate>
            <Triggers>
                <asp:PostBackTrigger ControlID="SetPhotoBtn" />
            </Triggers>
        </asp:UpdatePanel>
       </div>
   

&nbsp;&nbsp;&nbsp; 
   
       </form>
   
    </body>
</html>
