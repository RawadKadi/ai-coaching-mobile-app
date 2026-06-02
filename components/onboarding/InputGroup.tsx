import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface InputGroupProps extends Omit<TextInputProps, 'onChange'> {
  label: string;
  value: string;
  onChange: (text: string) => void;
}

export default function InputGroup({ label, value, onChange, placeholder, ...rest }: InputGroupProps) {
  return (
    <View>
      <Text className="text-slate-400 text-sm font-black uppercase tracking-widest mb-3 px-1">{label}</Text>
      <TextInput 
        className="bg-slate-900/50 p-6 rounded-[24px] border-2 border-slate-900 text-white font-black text-base"
        placeholder={placeholder}
        placeholderTextColor="#1E293B"
        value={value}
        onChangeText={onChange}
        {...rest}
      />
    </View>
  );
}
