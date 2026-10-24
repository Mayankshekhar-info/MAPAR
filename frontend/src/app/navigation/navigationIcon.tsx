import React from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import SpeedIcon from "@mui/icons-material/Speed";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import PeopleIcon from "@mui/icons-material/People";
import ShieldIcon from "@mui/icons-material/Shield";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TuneIcon from "@mui/icons-material/Tune";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import NotificationsIcon from "@mui/icons-material/Notifications";
import BusinessIcon from "@mui/icons-material/Business";
import WorkIcon from "@mui/icons-material/Work";
import PublicIcon from "@mui/icons-material/Public";
import SecurityIcon from "@mui/icons-material/Security";
import GroupsIcon from "@mui/icons-material/Groups";
import CircleIcon from "@mui/icons-material/Circle";

const iconMap: Record<string, React.ElementType> = {
  Dashboard: DashboardIcon,
  AccountTree: AccountTreeIcon,
  Slideshow: SlideshowIcon,
  Speed: SpeedIcon,
  SyncAlt: SyncAltIcon,
  People: PeopleIcon,
  Shield: ShieldIcon,
  FactCheck: FactCheckIcon,
  FolderShared: FolderSharedIcon,
  MonetizationOn: MonetizationOnIcon,
  Assessment: AssessmentIcon,
  Tune: TuneIcon,
  CloudUpload: CloudUploadIcon,
  ManageAccounts: ManageAccountsIcon,
  AdminPanelSettings: AdminPanelSettingsIcon,
  VpnKey: VpnKeyIcon,
  Notifications: NotificationsIcon,
  Business: BusinessIcon,
  Work: WorkIcon,
  Public: PublicIcon,
  Security: SecurityIcon,
  Groups: GroupsIcon,
};

interface NavigationIconProps {
  name: string;
  fontSize?: "inherit" | "small" | "medium" | "large";
  sx?: Record<string, any>;
}

export const NavigationIcon: React.FC<NavigationIconProps> = ({ name, fontSize = "small", sx }) => {
  const IconComponent = iconMap[name] || CircleIcon;
  return <IconComponent fontSize={fontSize} sx={sx} />;
};
