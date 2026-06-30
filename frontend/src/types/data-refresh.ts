/** データパネル個別更新用の共通 props */
export interface DataRefreshProps {
  onRefresh?: () => void;
  refreshing?: boolean;
}
