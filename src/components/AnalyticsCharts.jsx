import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '../utils/money';

const palette = ['#7162df', '#39a887', '#e5a34d', '#d97889', '#4e91c4', '#9b79bb', '#82a65a'];

export function MonthlySpendChart({ data, label = 'Spend by month' }) {
  return <ResponsiveContainer width="100%" height={240}><BarChart data={data}><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value) => formatMoney(value)} /><Bar dataKey="amount" name={label} radius={[5, 5, 0, 0]} fill="var(--primary)" barSize={25} /></BarChart></ResponsiveContainer>;
}

export function CategorySpendChart({ data, total }) {
  return <><div className="donut-wrap"><ResponsiveContainer width="100%" height={175}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={49} outerRadius={72} paddingAngle={3}>{data.map((item, index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}</Pie><Tooltip formatter={(value) => formatMoney(value)} /></PieChart></ResponsiveContainer><div className="donut-label"><b>{formatMoney(total)}</b><small>all recorded</small></div></div><div className="legend">{data.map((item, index) => <span key={item.name}><i style={{ background: palette[index % palette.length] }} />{item.name}<b>{formatMoney(item.value)}</b></span>)}</div></>;
}
