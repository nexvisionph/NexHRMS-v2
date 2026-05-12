USE [master]
/****** Object:  Database [AttDB2]    Script Date: 2018-11-4 ******/
IF  EXISTS (SELECT name FROM sys.databases WHERE name = N'AttDB2')
DROP DATABASE [AttDB2]
GO

/****** Object:  Database [AttDB2]    Script Date: 2018-11-4 ******/
CREATE DATABASE [AttDB2] ON PRIMARY 
( NAME = N'AttDB2', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL10_50.SQLEXPRESS\MSSQL\DATA\AttDB2.mdf' , SIZE = 3072KB , MAXSIZE = UNLIMITED, FILEGROWTH = 1024KB )
 LOG ON 
( NAME = N'AttDB2_log', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL10_50.SQLEXPRESS\MSSQL\DATA\AttDB2_log.ldf' , SIZE = 1024KB , MAXSIZE = 2048GB , FILEGROWTH = 10%)
GO

IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [AttDB2].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO

ALTER DATABASE [AttDB2] SET ANSI_NULL_DEFAULT OFF 
GO

ALTER DATABASE [AttDB2] SET ANSI_NULLS OFF 
GO

ALTER DATABASE [AttDB2] SET ANSI_PADDING OFF 
GO

ALTER DATABASE [AttDB2] SET ANSI_WARNINGS OFF 
GO

ALTER DATABASE [AttDB2] SET ARITHABORT OFF 
GO

ALTER DATABASE [AttDB2] SET AUTO_CLOSE OFF 
GO

ALTER DATABASE [AttDB2] SET AUTO_CREATE_STATISTICS ON 
GO

ALTER DATABASE [AttDB2] SET AUTO_SHRINK OFF 
GO

ALTER DATABASE [AttDB2] SET AUTO_UPDATE_STATISTICS ON 
GO

ALTER DATABASE [AttDB2] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO

ALTER DATABASE [AttDB2] SET CURSOR_DEFAULT  GLOBAL 
GO

ALTER DATABASE [AttDB2] SET CONCAT_NULL_YIELDS_NULL OFF 
GO

ALTER DATABASE [AttDB2] SET NUMERIC_ROUNDABORT OFF 
GO

ALTER DATABASE [AttDB2] SET QUOTED_IDENTIFIER OFF 
GO

ALTER DATABASE [AttDB2] SET RECURSIVE_TRIGGERS OFF 
GO

ALTER DATABASE [AttDB2] SET  DISABLE_BROKER 
GO

ALTER DATABASE [AttDB2] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO

ALTER DATABASE [AttDB2] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO

ALTER DATABASE [AttDB2] SET TRUSTWORTHY OFF 
GO

ALTER DATABASE [AttDB2] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO

ALTER DATABASE [AttDB2] SET PARAMETERIZATION SIMPLE 
GO

ALTER DATABASE [AttDB2] SET READ_COMMITTED_SNAPSHOT OFF 
GO


ALTER DATABASE [AttDB2] SET  READ_WRITE 
GO

ALTER DATABASE [AttDB2] SET RECOVERY SIMPLE 
GO

ALTER DATABASE [AttDB2] SET  MULTI_USER 
GO

ALTER DATABASE [AttDB2] SET PAGE_VERIFY CHECKSUM  
GO

ALTER DATABASE [AttDB2] SET DB_CHAINING OFF 
GO

/*********************************************************************************************************/
USE [AttDB2]
GO
/****** Object:  Table [dbo].[tbl_device]    Script Date: 2018-11-4 ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_device]') AND type in (N'U'))
DROP TABLE [dbo].[tbl_device]
GO

/****** Object:  Table [dbo].[tbl_device]    Script Date: 2018-11-4 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
SET ANSI_PADDING ON
GO
CREATE TABLE [dbo].[tbl_device](
	[id] [int] identity(1,1) primary key not null,
	[dev_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[name] [varchar](256) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[regtime] [datetime] NOT NULL,
	[detail] [varchar](max) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[status] [varchar](max) COLLATE Chinese_PRC_CI_AS,
)

GO
SET ANSI_PADDING OFF
GO

/*********************************************************************************************************/
USE [AttDB2]
GO
/****** Object:  Table [dbo].[tbl_command]    Script Date: 2018-11-4 ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_command]') AND type in (N'U'))
DROP TABLE [dbo].[tbl_command]
GO

/****** Object:  Table [dbo].[tbl_command]    Script Date: 2018-11-4 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
SET ANSI_PADDING ON
GO
-- 이 표는 지령의 입구파라메터자료를 보관하기 위한 표이다.
CREATE TABLE [dbo].[tbl_command](
	[id] [int] identity(1,1) primary key not null,
	[dev_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[command] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[param] [varchar](256) COLLATE Chinese_PRC_CI_AS NULL,
	[regtime] [datetime] NOT NULL,
	[lasttime] [datetime] NULL,
	[status] [int] NOT NULL, /* 0:DONE, 1:SET, 2:RECEIVE -1:CANCEL */
	[result_code] [varchar](256) COLLATE Chinese_PRC_CI_AS NULL,
) 

GO
SET ANSI_PADDING OFF
GO

/*********************************************************************************************************/
USE [AttDB2]
GO
/****** Object:  Table [dbo].[tbl_user]    Script Date: 2018-11-4 ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_user]') AND type in (N'U'))
DROP TABLE [dbo].[tbl_user]
GO

/****** Object:  Table [dbo].[tbl_user]    Script Date: 2018-11-4 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
SET ANSI_PADDING ON
GO
-- 이 표는 지령의 결과자료를 보관하기 위한 표이다.
CREATE TABLE [dbo].[tbl_user](
	[u_id] [int] identity(1,1) primary key not null,
	[dev_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[user_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL ,
	[name] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[privilige] [varchar](24) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[regtime] [datetime] NOT NULL,
	[note] [varchar](max) NULL,
) 

GO
SET ANSI_PADDING OFF
GO


/*********************************************************************************************************/
USE [AttDB2]
GO

/****** Object:  Table [dbo].[tbl_enroll]    Script Date: 02/08/2013 04:45:30 ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_enroll]') AND type in (N'U'))
DROP TABLE [dbo].[tbl_enroll]
GO

/****** Object:  Table [dbo].[tbl_enroll]    Script Date: 12/08/2012 11:38:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
SET ANSI_PADDING ON
GO
-- 이 표는 기대의 련결상태를 보여주는 표이다.
CREATE TABLE [dbo].[tbl_enroll](
	[id] [int] identity(1,1) primary key not null,
	[dev_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[user_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[backup_number] [int] NOT NULL,
	[regtime] [datetime] NOT NULL,
	[content] [varbinary](max) NULL,
) 

GO
SET ANSI_PADDING OFF
GO

/*********************************************************************************************************/
USE [AttDB2]
GO

/****** Object:  Table [dbo].[tbl_log]    Script Date: 02/08/2013 04:45:46 ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_log]') AND type in (N'U'))
DROP TABLE [dbo].[tbl_log]
GO

/****** Object:  Table [dbo].[tbl_log]    Script Date: 12/08/2012 11:39:10 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
SET ANSI_PADDING ON
GO
CREATE TABLE [dbo].[tbl_log](
	[id] [int] identity(1,1) primary key not null,
	[dev_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[user_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[verify_mode] [varchar](64) COLLATE Chinese_PRC_CI_AS NULL,
	[io_mode] [varchar](32) COLLATE Chinese_PRC_CI_AS NULL,
	[io_time] [datetime] NULL,
	[temperature] [varchar](32) COLLATE Chinese_PRC_CI_AS NULL,

) ON [PRIMARY]

GO
SET ANSI_PADDING OFF
GO

/****** Object:  Table [dbo].[tbl_log_image]    Script Date: 02/08/2013 04:45:46 ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_log_image]') AND type in (N'U'))
DROP TABLE [dbo].[tbl_log_image]
GO

/****** Object:  Table [dbo].[tbl_log_image]    Script Date: 12/08/2012 11:39:10 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
SET ANSI_PADDING ON
GO
CREATE TABLE [dbo].[tbl_log_image](
	[id] [int] identity(1,1) primary key not null,
	[dev_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[user_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[io_time] [datetime] NULL,
	[log_image] [varbinary](max) NULL
) ON [PRIMARY]

GO
SET ANSI_PADDING OFF
GO

/*********************************************************************************************************/
USE [AttDB2]
GO

/****** Object:  Table [dbo].[tbl_oper_log]    Script Date: 02/08/2013 04:45:46 ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_oper_log]') AND type in (N'U'))
DROP TABLE [dbo].[tbl_oper_log]
GO

/****** Object:  Table [dbo].[tbl_oper_log]    Script Date: 12/08/2012 11:39:10 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
SET ANSI_PADDING ON
GO
CREATE TABLE [dbo].[tbl_oper_log](
	[id] [int] identity(1,1) primary key not null,
	[dev_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[user_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[oper_code] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[oper_time] [datetime] NULL,
	[oper_detail] [varchar](max) NULL,
	[reg_time] [datetime] NULL,

) ON [PRIMARY]

GO
SET ANSI_PADDING OFF
GO

/*********************************************************************************************************/
USE [AttDB2]
GO

/****** Object:  Table [dbo].[tbl_barcode]    Script Date: 11/05/2021 16:45:30 ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_barcode]') AND type in (N'U'))
DROP TABLE [dbo].[tbl_barcode]
GO

/****** Object:  Table [dbo].[tbl_barcode]    Script Date: 11/05/2021 16:45:30 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
SET ANSI_PADDING ON
GO
-- 이 표는 기대에서 올라오는 바코드를 보관하는 표이다.
CREATE TABLE [dbo].[tbl_barcode](
	[id] [int] identity(1,1) primary key not null,
	[dev_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[regtime] [datetime] NOT NULL,
	[content] [varbinary](max) NULL,
) 

GO
SET ANSI_PADDING OFF
GO

/****** Object:  Table [dbo].[tbl_trans]    Script Date: 02/08/2013 04:45:46 ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tbl_trans]') AND type in (N'U'))
DROP TABLE [dbo].[tbl_trans]
GO

/****** Object:  Table [dbo].[tbl_trans]    Script Date: 12/08/2012 11:39:10 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
SET ANSI_PADDING ON
GO
CREATE TABLE [dbo].[tbl_trans](
	[dev_id] [varchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[blk_no] [int] NOT NULL,
	[buff_len] [int] NOT NULL,
	[buffer] [varbinary](max) NOT NULL
) ON [PRIMARY]

GO
SET ANSI_PADDING OFF
GO

/****** Object:  StoredProcedure ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_update_device_conn_status]') AND type in (N'P', N'PC'))
DROP PROCEDURE [dbo].[usp_update_device_conn_status]
GO

-- =============================================
-- Author:	PEFIS, 리일현
-- Create date: 2013-12-21
-- Modified date: 2019-7-4
-- Description:	기대의 접속상태표를 갱신한다.
--   기대는 일정한 시간간격으로 자기에게 발해된 지령이 있는가를 문의한다. 이때 기대의 접속상태표를 갱신한다.
--   이때 기대는 기대시간과 기대의 펌웨어는 무엇인가 등과 같은 정보를 함께 올려 보낸다.
-- =============================================
CREATE PROCEDURE [dbo].[usp_update_device_conn_status]
	-- Add the parameters for the stored procedure here
	@dev_id varchar(24),
	@dev_name varchar(24),
	@dev_info nvarchar(2048)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Insert statements for procedure here
	declare @dev_registered int
	if len(@dev_id) < 1 
		return -1
	if len(@dev_name) < 1 
		return -1
	
	begin transaction
	
	SELECT @dev_registered = COUNT(dev_id) from tbl_device WHERE dev_id=@dev_id
	if  @dev_registered = 0
	begin
		INSERT INTO tbl_device( 
				dev_id, 
				name, 
				regtime, 
				detail)
			VALUES(
				@dev_id,
				@dev_name, 
				GETDATE(),
				@dev_info)
	end	
	else -- if @@ROWCOUNT = 0
	begin
		UPDATE tbl_device SET 
				dev_id=@dev_id, 
				name=@dev_name, 
				regtime=GETDATE(),
				detail=@dev_info
			WHERE 
				dev_id=@dev_id
	end
	
	if @@error <> 0
	begin
		rollback transaction
		return -2
	end
	
	commit transaction
	return 0
END -- proc: usp_update_device_conn_status


IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_publish_command]') AND type in (N'P', N'PC'))
DROP PROCEDURE [dbo].[usp_publish_command]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:	PEFIS, 리일현
-- Create date: 2013-12-21
-- Modified date: 2019-7-4
-- Description:	'기대재기동'지령이 발행된것이 있으면 그것을 기대로 내려보낸다.
--  지령이 발행된 상태 1.
--  지령이 수행중인 상태 2.
--  지령이 수행된 상태 0.
--  지령이 취소된 상태 -1.
-- =============================================
CREATE PROCEDURE usp_publish_command
	-- Add the parameters for the stored procedure here
	@dev_id varchar(24),
	@name varchar(24),
	@param varchar(256),
	@trans_id varchar(16) output
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- trans_id를 무효한 값으로 설정한다.
    select @trans_id=''
    if @dev_id is null or len(@dev_id) = 0
		return -1
		
    if @name is null or len(@name) = 0
		return -1
	
	begin transaction
	BEGIN TRY
		insert into tbl_command (
				dev_id, 
				command, 
				param, 
				status, 
				regtime)
			values(
				@dev_id, 
				@name, 
				@param, 
				1, 
				GETDATE())
		select @trans_id=@@IDENTITY		
		-- select @trans_id=ident_current('tbl_command')
	END TRY
    BEGIN CATCH
		rollback transaction
		select @trans_id=''
		return -2
    END CATCH

	commit transaction
	return 0
END -- proc: usp_publish_command
GO


GO

IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_receive_cmd]') AND type in (N'P', N'PC'))
DROP PROCEDURE [dbo].[usp_receive_cmd]
GO

-- =============================================
-- Author:	PEFIS, 리일현
-- Create date: 2013-12-24
-- Modified date: 2014-12-4
-- Modified date: 2019-7-4
-- Description:	기대가 자기에게로 발행한 지령을 얻어낼때 호출된다.
--  tbl_fkcmd_trans표에서 지령수행상태가 'WAIT'로 되여 있는것들 가운데서 가장 시간이 오래된것을 얻어낸 다음 상태를 'RUN'으로 바꾼다.
--  일부 지령들에 대해서(SET_ENROLL_DATA, SET_USER_INO)의 파라메터들은
--   tbl_command 표에 존재하게 된다.
--
--  만일 어떤 기대에 대해서 발행된 새 지령을 얻는 시점에서
--   tbl_fkcmd_trans표에 이 기대로 발행된 지령들중 상태가 'RUN'인 지령들이 존재하면 그 지령들의 상태를 'CANCELLED'로 바꾼다.
--  기대가 지령을 받아 처리하고 결과를 올려보내던 중 어떤 문제로 하여 결과를 올려보내지 못하여 이러한 기록들이 생길수 있다.
--  이러한 지령들은 상태가 'RUN'에서 더 바뀔 가능성이 없으므로 상태를 'CANCELLED'로 바꾼다.
-- 또한 상태를 'RUN'으로부터 'CANCELLED'로 바꿀때 tbl_command, tbl_user 표들에 남아있는 잔해들을 지운다.
-- =============================================
CREATE PROCEDURE [dbo].[usp_receive_cmd]
	-- Add the parameters for the stored procedure here
	@dev_id varchar(24),
	@trans_id varchar(16) output,
	@name varchar(32) output,
	@cmd_param varchar(256) output
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    select @trans_id = ''
	-- 파라메터들을 검사한다.
	if @dev_id is null or len(@dev_id) = 0
		return -1
	
	begin transaction
	BEGIN TRY
		select TOP 1 
			@trans_id = id,
			@name = command,
			@cmd_param = param			 
		from tbl_command
		where dev_id=@dev_id AND status=1
		order by regtime
		
		UPDATE tbl_command SET status=-1 WHERE status=2 AND dev_id=@dev_id -- cancel running command 
		
		UPDATE tbl_command SET status=2, lasttime = GETDATE() WHERE id=@trans_id
		if @name='RESET_FK'
			UPDATE tbl_command SET status=0, lasttime = GETDATE() WHERE id=@trans_id
		
	END TRY
    BEGIN CATCH
		rollback transaction
		select @trans_id=''
		return -2
    END CATCH
	commit transaction
	
	return 0
END -- proc: usp_receive_cmd
GO

IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_set_cmd_result]') AND type in (N'P', N'PC'))
DROP PROCEDURE [dbo].[usp_set_cmd_result]
GO

-- =============================================
-- Author:	PEFIS, 리일현
-- Create date: 2014-12-5
-- Modified date: 2019-7-4
-- Description:	기대가 지령수행결과를 올려보낼때 호출된다.
--  지령의 수행결과 얻어진 자료를 tbl_user 표에 보관한다.
--  tbl_fkcmd_trans 표에서 trans_id 에 해당한 지령의 수행상태가 'RUN'로 되여 있는 경우
--   지령의 결과코드를 보관하고 그 지령의 상태를 'RESULT'로 바꾼다.
-- =============================================
CREATE PROCEDURE [dbo].[usp_set_cmd_result]
	-- Add the parameters for the stored procedure here
	@dev_id varchar(24),
	@trans_id varchar(16),
	@return_code varchar(128)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	-- 파라메터들을 검사한다.
	if @dev_id is null or len(@dev_id) = 0
		return -1
	if @trans_id is null or len(@trans_id) = 0
		return -1
	
	begin transaction
	BEGIN TRY
		update tbl_command set status=0, result_code=@return_code, lasttime = GETDATE() where id=@trans_id
	END TRY
    BEGIN CATCH
		rollback transaction
		return -3
    END CATCH
	
	if @@error <> 0
	begin
		rollback transaction
		return -3
	end
	commit transaction
	
	return 0
END -- proc: usp_set_cmd_result
GO

IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_init_db]') AND type in (N'P', N'PC'))
DROP PROCEDURE [dbo].[usp_init_db]
GO

-- =============================================
-- Author:	PEFIS, 리일현
-- Create date: 2019-7-4
-- Description:clear all data in DB
-- =============================================
CREATE PROCEDURE [dbo].[usp_init_db]
	-- Add the parameters for the stored procedure here
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	-- 파라메터들을 검사한다.
	
	begin transaction
	BEGIN TRY
		truncate table tbl_device
		truncate table tbl_command
		truncate table tbl_user
		truncate table tbl_enroll
		truncate table tbl_log
		truncate table tbl_log_image
		truncate table tbl_trans
	END TRY
    BEGIN CATCH
		rollback transaction
		return -3
    END CATCH
	
	if @@error <> 0
	begin
		rollback transaction
		return -3
	end
	commit transaction
	
	return 0
END -- proc: usp_init_db
GO

IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_init_device]') AND type in (N'P', N'PC'))
DROP PROCEDURE [dbo].[usp_init_device]
GO

-- =============================================
-- Author:	PEFIS, 리일현
-- Create date: 2019-7-4
-- Description:clear all data in DB
-- =============================================
CREATE PROCEDURE [dbo].[usp_init_device]
	-- Add the parameters for the stored procedure here
	@dev_id varchar(24)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	-- 파라메터들을 검사한다.
	if @dev_id is null or len(@dev_id) = 0
		return -1
	
	begin transaction
	BEGIN TRY
		delete from tbl_command where dev_id=@dev_id
		delete from tbl_user where dev_id=@dev_id
		delete from tbl_enroll where dev_id=@dev_id
		delete from tbl_log where dev_id=@dev_id
		delete from tbl_log_image where dev_id=@dev_id
		delete from tbl_trans where dev_id=@dev_id
	END TRY
    BEGIN CATCH
		rollback transaction
		return -3
    END CATCH
	
	if @@error <> 0
	begin
		rollback transaction
		return -3
	end
	commit transaction
	
	return 0
END -- proc: usp_init_device
GO

IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_init_user]') AND type in (N'P', N'PC'))
DROP PROCEDURE [dbo].[usp_init_user]
GO

-- =============================================
-- Author:	PEFIS, 리일현
-- Create date: 2019-7-4
-- Description:clear all data in DB
-- =============================================
CREATE PROCEDURE [dbo].[usp_init_user]
	-- Add the parameters for the stored procedure here
	@dev_id varchar(24)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	-- 파라메터들을 검사한다.
	if @dev_id is null or len(@dev_id) = 0
		return -1
	
	begin transaction
	BEGIN TRY
		delete from tbl_user where dev_id=@dev_id
		delete from tbl_enroll where dev_id=@dev_id
		delete from tbl_log where dev_id=@dev_id
		delete from tbl_log_image where dev_id=@dev_id
	END TRY
    BEGIN CATCH
		rollback transaction
		return -3
    END CATCH
	
	if @@error <> 0
	begin
		rollback transaction
		return -3
	end
	commit transaction
	
	return 0
END -- proc: usp_init_user
GO

IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_delete_user]') AND type in (N'P', N'PC'))
DROP PROCEDURE [dbo].[usp_delete_user]
GO

-- =============================================
-- Author:	PEFIS, 리일현
-- Create date: 2019-7-4
-- Description:clear all data in DB
-- =============================================
CREATE PROCEDURE [dbo].[usp_delete_user]
	-- Add the parameters for the stored procedure here
	@dev_id varchar(24),
	@user_id varchar(24)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	-- 파라메터들을 검사한다.
	if @dev_id is null or len(@dev_id) = 0
		return -1
	
	begin transaction
	BEGIN TRY
		delete from tbl_user where dev_id=@dev_id and user_id=@user_id
		delete from tbl_enroll where dev_id=@dev_id and user_id=@user_id
		delete from tbl_log where dev_id=@dev_id and user_id=@user_id
		delete from tbl_log_image where dev_id=@dev_id and user_id=@user_id
	END TRY
    BEGIN CATCH
		rollback transaction
		return -3
    END CATCH
	
	if @@error <> 0
	begin
		rollback transaction
		return -3
	end
	commit transaction
	
	return 0
END -- proc: usp_delete_user

GO

IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_init_log]') AND type in (N'P', N'PC'))
DROP PROCEDURE [dbo].[usp_init_log]
GO

-- =============================================
-- Author:	PEFIS, 리일현
-- Create date: 2019-7-4
-- Description:clear all data in DB
-- =============================================
CREATE PROCEDURE [dbo].[usp_init_log]
	-- Add the parameters for the stored procedure here
	@dev_id varchar(24)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	-- 파라메터들을 검사한다.
	if @dev_id is null or len(@dev_id) = 0
		return -1
	
	begin transaction
	BEGIN TRY
		delete from tbl_log where dev_id=@dev_id
		delete from tbl_log_image where dev_id=@dev_id
	END TRY
    BEGIN CATCH
		rollback transaction
		return -3
    END CATCH
	
	if @@error <> 0
	begin
		rollback transaction
		return -3
	end
	commit transaction
	
	return 0
END -- proc: usp_init_log

