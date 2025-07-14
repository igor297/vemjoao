import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CondominiumSetting from '@/models/CondominiumSetting';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const url = new URL(request.url);
    const condominioId = url.searchParams.get('condominio_id');
    const masterId = url.searchParams.get('master_id');

    if (!condominioId || !masterId) {
      return NextResponse.json(
        { success: false, error: 'condominio_id and master_id are required' },
        { status: 400 }
      );
    }

    const setting = await CondominiumSetting.findOne({ condominio_id: condominioId, master_id: masterId }).lean();

    if (!setting) {
      return NextResponse.json(
        { success: true, setting: null, message: 'No setting found for this condominium' },
        { status: 200 }
      );
    }
    
    return NextResponse.json({
      success: true,
      setting: setting
    });
    
  } catch (error) {
    console.error('Error fetching condominium setting:', error);
    return NextResponse.json(
      { error: 'Error fetching condominium setting' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ler o body uma única vez
    const body = await request.json();
    const { condominio_id, use_ticketing_system, master_id } = body;
    
    if (!master_id) {
      return NextResponse.json(
        { error: 'master_id is required' },
        { status: 400 }
      );
    }

    if (!condominio_id || typeof use_ticketing_system === 'undefined') {
      return NextResponse.json(
        { error: 'condominio_id and use_ticketing_system are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const masterObjectId = new mongoose.Types.ObjectId(master_id);

    const existingSetting = await CondominiumSetting.findOne({ condominio_id: condominio_id, master_id: masterObjectId });

    let result;
    if (existingSetting) {
      existingSetting.use_ticketing_system = use_ticketing_system;
      result = await existingSetting.save();
    } else {
      const newSetting = new CondominiumSetting({
        condominio_id: condominio_id,
        use_ticketing_system: use_ticketing_system,
        master_id: masterObjectId,
      });
      result = await newSetting.save();
    }
    
    return NextResponse.json({
      success: true,
      setting: result
    });
    
  } catch (error) {
    console.error('Error saving condominium setting:', error);
    return NextResponse.json(
      { error: 'Error saving condominium setting' },
      { status: 500 }
    );
  }
}
