import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Text, useParent } from 'react-tela';
import { Footer } from '../components/Footer';
import {
	NROForwarderIcon,
	RetroArchForwarderIcon,
} from '../components/ForwarderIcon';
import { useDirection, useGamepadButton } from '../hooks/use-gamepad';

const NEXT_ROUTES = ['/select', '/select-retroarch'];

export function SelectForwarderType() {
	const root = useParent();
	const navigate = useNavigate();
	const [selectedIndex, setSelectedIndex] = useState(0);

	useGamepadButton('A', () => navigate(NEXT_ROUTES[selectedIndex]), [
		navigate,
		selectedIndex,
	]);

	useDirection('Left', () => setSelectedIndex(0), []);

	useDirection('Right', () => setSelectedIndex(1), []);

	return (
		<>
			<Text
				fill='white'
				fontSize={32}
				textAlign='center'
				x={root.ctx.canvas.width / 2}
				y={100}
			>
				What type of forwarder do you want to generate?
			</Text>
			<NROForwarderIcon
				x={root.ctx.canvas.width / 2 - 380}
				y={200}
				selected={selectedIndex === 0}
				onTouchEnd={() => navigate(NEXT_ROUTES[0])}
			/>
			<RetroArchForwarderIcon
				x={root.ctx.canvas.width / 2 + 50}
				y={200}
				selected={selectedIndex === 1}
				onTouchEnd={() => navigate(NEXT_ROUTES[1])}
			/>
			<Footer
				actions={[
					{ button: 'Plus', label: 'Exit' },
					{ button: 'A', label: 'Select' },
				]}
			/>
		</>
	);
}
