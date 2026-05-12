<%@ page language="C#" autoeventwireup="true" inherits="PassManage, App_Web_lofxcc4m" enableEventValidation="false" %>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title>Untitled Page</title>
</head>
<body>
    <form id="form1" runat="server">
     <asp:ScriptManager ID="ScriptManager1" runat="server"></asp:ScriptManager>
        <div>
         <asp:UpdatePanel ID="UpdatePanel2" runat="server" UpdateMode="Always">
        <ContentTemplate>
    <div>
    
    <div style="border: thin hidden #00FF00; font-size: xx-large; background-color: #C0C0D0; height: 49px; margin-bottom: 17px;">
    
    &nbsp;&nbsp; FKAttend BS Sample <asp:Label ID="Version" runat="server"></asp:Label></div>
    
    </div>
        <asp:Panel ID="Panel1" runat="server" BackColor="#CCCCCC" Font-Size="Large" 
            Height="28px" style="margin-bottom: 10px">
            &nbsp;&nbsp;&nbsp;&nbsp; Pass Manage&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:Label ID="Label1" runat="server" Text="Device ID :"></asp:Label>
            &nbsp;&nbsp;
            <asp:Label ID="DevID" runat="server"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp; &nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            
            
            <asp:LinkButton ID="goback" runat="server" onclick="goback_Click">Go Home</asp:LinkButton>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </asp:Panel>

        
        <asp:Panel ID="Panel2" runat="server" BackColor="#EEEEEE" Height="383px" 
            style="margin-bottom: 12px" Width="1054px">
            <table border = 0><tr><td>
            Pass Time Info
            <table border = 0>
            <tr>
            <td></td>
            <td></td>
            <td>Start Time</td>
            <td></td>
            <td>End Time</td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td>Sun</td>
            <td><asp:TextBox ID="PassTime00" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime01" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>~</td>
            <td><asp:TextBox ID="PassTime02" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime03" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td>Mon</td>
            <td><asp:TextBox ID="PassTime10" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime11" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>~</td>
            <td><asp:TextBox ID="PassTime12" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime13" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td>Tue</td>
            <td><asp:TextBox ID="PassTime20" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime21" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>~</td>
            <td><asp:TextBox ID="PassTime22" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime23" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td>Wen</td>
            <td><asp:TextBox ID="PassTime30" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime31" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>~</td>
            <td><asp:TextBox ID="PassTime32" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime33" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td>Thu</td>
            <td><asp:TextBox ID="PassTime40" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime41" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>~</td>
            <td><asp:TextBox ID="PassTime42" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime43" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td>Fri</td>
            <td><asp:TextBox ID="PassTime50" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime51" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>~</td>
            <td><asp:TextBox ID="PassTime52" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime53" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td>Sat</td>
            <td><asp:TextBox ID="PassTime60" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime61" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>~</td>
            <td><asp:TextBox ID="PassTime62" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>:<asp:TextBox ID="PassTime63" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td>TZ(1~50)</td>
            <td><asp:TextBox ID="PassTimeNo" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td><asp:Button ID="ReadPassTimeBtn" runat="server" Height="30px" onclick="ReadPassTimeBtn_Click" Text="Read PassTime" Width="150px" /></td>
            <td></td>
            <td><asp:Button ID="WritePassTimeBtn" runat="server" Height="30px" onclick="WritePassTimeBtn_Click" Text="Write PassTime" Width="150px" /></td>
            </tr>
            </table>
            Door Status
            <table border = 0>
            <tr>
            <td></td>
            <td>
            <asp:DropDownList ID="DoorStatus" runat="server" Width="100px">
                <asp:ListItem Value="unknown"></asp:ListItem>
                <asp:ListItem Value="on">on</asp:ListItem>
                <asp:ListItem Value="off">off</asp:ListItem>
            </asp:DropDownList>
            </td><td>
            <asp:Button ID="SetDoorBtn" runat="server" Height="30px" onclick="SetDoorBtn_Click" Text="Set Door Status" Width="150px" />
            </td><td>
            <asp:Button ID="GetDoorBtn" runat="server" Height="30px" onclick="GetDoorBtn_Click" Text="Get Door Status" Width="150px" />
            </td></tr></table>

            </td><td>&nbsp;&nbsp;&nbsp;</td><td>

            User Pass
            <table border = 0>
            <tr>
            <td></td>
            <td></td>
            <td>User ID</td>
            <td></td>
            <td><asp:TextBox ID="UserID" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td>Group(1~5)</td>
            <td><asp:TextBox ID="UserPassTime0" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>TZ1:<asp:TextBox ID="UserPassTime1" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>TZ2:</td>
            <td><asp:TextBox ID="UserPassTime2" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox>TZ3:<asp:TextBox ID="UserPassTime3" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td></td>
            <td><asp:Button ID="GetUserPassBtn" runat="server" Height="30px" onclick="GetUserPassBtn_Click" Text="Get UserPass" Width="150px" /></td>
            <td></td>
            <td><asp:Button ID="SetUserPassBtn" runat="server" Height="30px" onclick="SetUserPassBtn_Click" Text="Set UserPass" Width="150px" /></td>
            </tr>
            </table>

            Group Pass
            <table border = 0>
            <tr>
            <td></td>
            <td></td>
            <td>Group ID</td>
            <td colspan=3><asp:TextBox ID="GroupID" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td></td>
            <td>TZ1:<asp:TextBox ID="GroupPass0" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>TZ2:<asp:TextBox ID="GroupPass1" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td>TZ3:<asp:TextBox ID="GroupPass2" runat="server" Height="20px" MaxLength="10" Width="50px"></asp:TextBox></td>
            <td></td>
            </tr>
            <tr>
            <td></td>
            <td></td>
            <td><asp:Button ID="GetGroupPassBtn" runat="server" Height="30px" onclick="GetGroupPassBtn_Click" Text="Get GroupPass" Width="150px" /></td>
            <td></td>
            <td><asp:Button ID="SetGroupPassBtn" runat="server" Height="30px" onclick="SetGroupPassBtn_Click" Text="Set GroupPass" Width="150px" /></td>
            </tr>
            </table>

            Combined Groups
            <table border = 0>
            <tr>
			<td>&nbsp;&nbsp;&nbsp;</td>
			<td>&nbsp;1</td>                    
			<td>&nbsp;2</td>                    
			<td>&nbsp;3</td>                    
			<td>&nbsp;4</td>                    
			<td>&nbsp;5</td>                    
			<td>&nbsp;6</td>                    
			<td>&nbsp;7</td>                    
			<td>&nbsp;8</td>                    
			<td>&nbsp;9</td>                    
			<td>&nbsp;10</td>                   
			</tr>                               
            <tr>
            <td></td>
            <td><asp:TextBox ID="CombineGroup0" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            <td><asp:TextBox ID="CombineGroup1" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            <td><asp:TextBox ID="CombineGroup2" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            <td><asp:TextBox ID="CombineGroup3" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            <td><asp:TextBox ID="CombineGroup4" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            <td><asp:TextBox ID="CombineGroup5" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            <td><asp:TextBox ID="CombineGroup6" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            <td><asp:TextBox ID="CombineGroup7" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            <td><asp:TextBox ID="CombineGroup8" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            <td><asp:TextBox ID="CombineGroup9" runat="server" Height="20px" MaxLength="10" Width="30px"></asp:TextBox></td>
            </tr>
            <tr>
            <td></td>
            <td></td>
            <td colspan=4><asp:Button ID="GetCombineGroupBtn" runat="server" Height="30px" onclick="GetCombineGroupBtn_Click" Text="Get Combined Pass" Width="150px" /></td>
            <td></td>
            <td colspan=4><asp:Button ID="SetCombineGroupBtn" runat="server" Height="30px" onclick="SetCombineGroupBtn_Click" Text="Set Combined Pass" Width="150px" /></td>
            </tr>
            </table>

            </td></tr></table>
            <asp:TextBox ID="mTransIdTxt" runat="server" Visible="False"></asp:TextBox>
        </asp:Panel>
            <asp:Panel ID="Panel5" runat="server" BorderStyle="Groove" Height="44px" 
                style="margin-top: 11px" BackColor="#EEEEEE">
                &nbsp;
                <asp:Label ID="Label9" runat="server" Font-Size="Large" Text="Status"></asp:Label>
                <br />
                &nbsp; &nbsp;&nbsp;&nbsp;
                <asp:Label ID="StatusTxt" runat="server"></asp:Label>
            </asp:Panel>
        <asp:timer ID="Timer" runat="server" Interval="10" OnTick="Timer_Watch" 
                    Enabled="False"></asp:timer>
        </ContentTemplate>
        </asp:UpdatePanel>
    </form>
</body>
</html>
